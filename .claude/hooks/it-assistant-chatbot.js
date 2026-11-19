/**
 * IT assistant chatbot (text-based RAG, runs fully in the browser).
 *
 * - Cute avatar button fixed at the bottom right.
 * - Clicking the avatar opens the chat and speaks (Web Speech API):
 *   "I am your IT assistant, how can i help you?"
 * - Retrieval: BM25 over a small knowledge base = built-in FAQ + the live
 *   board tasks (read from the page's global `state`, when present).
 * - Generation: no LLM and no network. The answer is composed from the
 *   best-matching passages, with their sources listed, so nothing leaves the page.
 *
 * Usage: <script src=".claude/hooks/it-assistant-chatbot.js" defer></script>
 * Colours follow the host page's CSS tokens (--surface, --fg, --primary, ...) when present.
 */
(function () {
  'use strict';

  var GREETING = 'I am your IT assistant, how can i help you?';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Knowledge base (edit freely) ---------- */
  var FAQ = [
    { title: 'IT meeting', text: 'There is an IT meeting next Wed 10am at room 888. Everyone on the IT PMO team should attend.' },
    { title: 'Add a task', text: 'Click the Add Task button in the header. Fill in the title, assignee and due date (required), choose the project, category, priority and status, then press Add Task. The card appears straight away on the board.' },
    { title: 'Move a task', text: 'Drag a card onto another column, or press the Move button on the card and pick a status: Backlog, In Progress, Blocked or Done.' },
    { title: 'Delete a task', text: 'Press the bin icon at the top right of a card, then confirm with Yes, delete. Deleting cannot be undone.' },
    { title: 'Filter tasks', text: 'Use the toolbar under the header to filter by project, assignee name or priority. Press Clear filters to show everything again.' },
    { title: 'Status meanings', text: 'Backlog means logged but not yet scheduled. In Progress means actively being worked. Blocked means waiting on a dependency, vendor or approval. Done means completed or closed.' },
    { title: 'Priority levels', text: 'Priorities are Critical, High, Medium and Low. Each card shows its priority with a colour, a shape and a text label. Columns are sorted by priority, then due date.' },
    { title: 'Overdue tasks', text: 'A task is overdue when its due date is before today and it is not Done. Overdue cards show a red Overdue chip and the Overdue counter in the header turns red.' },
    { title: 'Data storage', text: 'This is a demo. Tasks live in memory only, so refreshing the page resets the board to the sample tasks.' },
    { title: 'Email notification', text: 'When a task is added the demo tries to send an email notification through FormSubmit. If it fails the card is still added locally and a warning appears.' },
    { title: 'Projects and workstreams', text: 'Projects are Core Banking Upgrade, Digital Channels, Cybersecurity Uplift, Data and Analytics, Infrastructure and Cloud, and Vendor Management.' },
    { title: 'Categories', text: 'Categories are Application Development, Infrastructure, Cybersecurity, Data, Compliance and Vendor.' },
    { title: 'Security and passwords', text: 'Never share passwords or tokens in chat or on the board. Report suspected phishing or a lost device to the IT service desk straight away.' }
  ];

  /* ---------- Retrieval: BM25 ---------- */
  var STOP = ('a an and are as at be but by can do does for from has have how i in is it its me my of on or our so ' +
    'that the their there this to us was we what when where which who why will with you your please tell about').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = true; });

  function stem(w) {
    return w.replace(/(ing|ed|es|s)$/, function (m, s, i) { return w.length - m.length >= 3 ? '' : m; });
  }
  function tokens(text) {
    return (String(text).toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter(function (w) { return !STOPSET[w]; }).map(stem);
  }

  function taskDocs() {
    var list = [];
    try { if (typeof state !== 'undefined' && state.tasks) list = state.tasks; } catch (e) { /* no board */ }
    var docs = list.map(function (t) {
      return {
        title: t.id + ' · ' + t.title, kind: 'task',
        text: t.id + ' ' + t.title + '. ' + (t.description || '') + ' Project ' + t.project + '. Category ' + t.category +
          '. Assigned to ' + t.assignee + '. Priority ' + t.priority + '. Status ' + t.status + '. Due ' + t.dueDate + '.',
        answer: t.id + ' "' + t.title + '" (' + t.project + ') is ' + t.status + ', ' + t.priority + ' priority, assigned to ' +
          t.assignee + ', due ' + t.dueDate + '.'
      };
    });
    if (list.length) {
      var today = new Date().toISOString().slice(0, 10);
      var by = function (f) { return list.filter(f).length; };
      var od = list.filter(function (t) { return t.status !== 'Done' && t.dueDate < today; });
      docs.push({
        title: 'Board summary', kind: 'summary',
        text: 'Board summary total tasks count how many. Backlog ' + by(function (t) { return t.status === 'Backlog'; }) +
          ' In Progress ' + by(function (t) { return t.status === 'In Progress'; }) +
          ' Blocked ' + by(function (t) { return t.status === 'Blocked'; }) +
          ' Done ' + by(function (t) { return t.status === 'Done'; }) + ' Overdue ' + od.length + '.',
        answer: 'The board has ' + list.length + ' tasks: ' +
          ['Backlog', 'In Progress', 'Blocked', 'Done'].map(function (s) { return by(function (t) { return t.status === s; }) + ' ' + s; }).join(', ') +
          '. ' + od.length + ' overdue' + (od.length ? ' (' + od.map(function (t) { return t.id; }).join(', ') + ')' : '') + '.'
      });
    }
    return docs;
  }

  function search(query, k) {
    var docs = FAQ.map(function (d) { return { title: d.title, text: d.text, answer: d.text, kind: 'faq' }; }).concat(taskDocs());
    var q = tokens(query);
    if (!q.length) return [];
    var N = docs.length, K1 = 1.4, B = 0.75, avg = 0;
    docs.forEach(function (d) { d.toks = tokens(d.title + ' ' + d.text); avg += d.toks.length; });
    avg /= N;
    var df = {};
    docs.forEach(function (d) { var seen = {}; d.toks.forEach(function (t) { if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } }); });
    docs.forEach(function (d) {
      var tf = {}; d.toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      var titleToks = tokens(d.title);
      d.score = 0;
      q.forEach(function (t) {
        if (!tf[t]) return;
        var idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
        d.score += idf * (tf[t] * (K1 + 1)) / (tf[t] + K1 * (1 - B + B * d.toks.length / avg));
        if (titleToks.indexOf(t) !== -1) d.score += idf * 0.5; // title matches count extra
      });
    });
    return docs.filter(function (d) { return d.score > 0.9; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, k || 3);
  }

  function answer(query) {
    var hits = search(query, 3);
    // Counting questions are answered from the live board summary.
    if (/how many|count|total|number of/i.test(query)) {
      var sum = taskDocs().filter(function (d) { return d.kind === 'summary'; })[0];
      if (sum) hits = [sum].concat(hits.filter(function (h) { return h.kind !== 'summary'; }));
    }
    if (!hits.length) {
      return { text: 'I could not find that in my notes. Try asking about adding or moving tasks, filters, priorities, overdue items, a task ID, or the IT meeting.', sources: [] };
    }
    var top = hits[0];
    var parts = [top.answer];
    // Add a second passage only if it is a close match and a different topic.
    if (hits[1] && hits[1].score > top.score * 0.8 && hits[1].kind === top.kind && hits[1].kind !== 'faq') parts.push(hits[1].answer);
    return { text: parts.join('\n'), sources: hits.filter(function (h, i) { return i === 0 || h.score > top.score * 0.8; }).slice(0, 2).map(function (h) { return h.title; }) };
  }

  /* ---------- Voice ---------- */
  var muted = false;
  function speak(text) {
    if (muted) return;
    try {
      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 1; u.pitch = 1.15;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  }

  /* ---------- UI ---------- */
  var AVATAR = '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">' +
    '<line x1="32" y1="6" x2="32" y2="13" stroke="#334155" stroke-width="3" stroke-linecap="round"/>' +
    '<circle class="ita-bulb" cx="32" cy="5" r="4" fill="#fbbf24"/>' +
    '<ellipse cx="12" cy="36" rx="4.5" ry="7" fill="#93c5fd"/><ellipse cx="52" cy="36" rx="4.5" ry="7" fill="#93c5fd"/>' +
    '<rect x="10" y="13" width="44" height="40" rx="20" fill="#e0f2fe" stroke="#334155" stroke-width="3"/>' +
    '<rect x="17" y="23" width="30" height="20" rx="10" fill="#0f172a"/>' +
    '<g class="ita-eyes"><ellipse cx="26" cy="33" rx="3.2" ry="4.2" fill="#67e8f9"/><ellipse cx="38" cy="33" rx="3.2" ry="4.2" fill="#67e8f9"/></g>' +
    '<path d="M28.5 39.5q3.5 3 7 0" stroke="#67e8f9" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<circle cx="19.5" cy="40" r="2.6" fill="#fda4af" opacity=".85"/><circle cx="44.5" cy="40" r="2.6" fill="#fda4af" opacity=".85"/>' +
    '</svg>';

  var CSS =
    '#ita-root{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:2147483000;font-family:var(--font,system-ui,sans-serif);font-size:14px;color:var(--fg,var(--text,#0f172a))}' +
    '#ita-btn{position:relative;display:block;width:68px;height:68px;padding:6px;border:0;border-radius:50%;cursor:pointer;background:linear-gradient(145deg,#bfdbfe,#fde68a);box-shadow:0 8px 24px rgba(15,23,42,.35);transition:transform .2s ease}' +
    '#ita-btn:hover{transform:scale(1.08) rotate(-3deg)}#ita-btn:focus-visible{outline:3px solid var(--ring,#1e3a8a);outline-offset:3px}' +
    '#ita-btn .ita-ico{display:block;width:100%;height:100%;animation:ita-bob 3.2s ease-in-out infinite}' +
    '.ita-eyes{transform-origin:32px 33px;animation:ita-blink 4.5s infinite}.ita-bulb{animation:ita-pulse 2s ease-in-out infinite}' +
    '#ita-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px/1 system-ui,sans-serif;padding:4px 6px;border-radius:999px;border:2px solid #fff}' +
    '@keyframes ita-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '@keyframes ita-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}' +
    '@keyframes ita-pulse{0%,100%{opacity:1}50%{opacity:.35}}' +
    '#ita-panel{position:absolute;right:0;bottom:82px;width:min(360px,calc(100vw - 32px));height:min(480px,calc(100vh - 120px));display:flex;flex-direction:column;overflow:hidden;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:18px;box-shadow:0 20px 48px rgba(2,6,23,.35);transform-origin:bottom right;animation:ita-pop .22s ease}' +
    '#ita-panel[hidden]{display:none}@keyframes ita-pop{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:none}}' +
    '#ita-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff}' +
    '#ita-head .ita-mini{width:34px;height:34px;border-radius:50%;background:#e0f2fe;padding:2px}' +
    '#ita-head strong{display:block;font-size:15px}#ita-head small{opacity:.85;font-size:12px}#ita-head .ita-grow{flex:1}' +
    '#ita-head button{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:15px}' +
    '#ita-head button:hover{background:rgba(255,255,255,.3)}#ita-head button:focus-visible{outline:2px solid #fff}' +
    '#ita-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--surface-sunken,#f8fafc)}' +
    '.ita-msg{max-width:86%;padding:9px 12px;border-radius:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.ita-bot{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-bottom-left-radius:4px}' +
    '.ita-user{align-self:flex-end;background:var(--primary,#1e3a8a);color:var(--on-primary,#fff);border-bottom-right-radius:4px}' +
    '.ita-src{display:block;margin-top:6px;font-size:11px;opacity:.7}' +
    '#ita-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px 0;background:var(--surface-sunken,#f8fafc)}' +
    '#ita-chips button{border:1px solid var(--border-strong,#cbd5e1);background:var(--surface,#fff);color:inherit;border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}' +
    '#ita-chips button:hover{background:var(--primary-soft,#eef2fb)}' +
    '#ita-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border,#e2e8f0);background:var(--surface,#fff)}' +
    '#ita-input{flex:1;min-width:0;min-height:38px;padding:0 12px;border:1px solid var(--border-strong,#cbd5e1);border-radius:999px;background:var(--surface,#fff);color:inherit;font:inherit}' +
    '#ita-form button{border:0;border-radius:999px;padding:0 16px;background:var(--primary,#1e3a8a);color:var(--on-primary,#fff);font:inherit;font-weight:600;cursor:pointer}' +
    '#ita-input:focus-visible,#ita-form button:focus-visible{outline:2px solid var(--ring,#1e3a8a);outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){#ita-btn .ita-ico,.ita-eyes,.ita-bulb,#ita-panel{animation:none}#ita-btn{transition:none}}';

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html) n.innerHTML = html;
    return n;
  }

  function build() {
    if (document.getElementById('ita-root')) return;
    var style = el('style'); style.textContent = CSS; document.head.appendChild(style);

    var root = el('div', { id: 'ita-root' });
    var btn = el('button', { id: 'ita-btn', type: 'button', 'aria-label': 'Open IT assistant chat', 'aria-expanded': 'false', 'aria-controls': 'ita-panel' }, '<span class="ita-ico">' + AVATAR + '</span><span id="ita-badge" aria-hidden="true">1</span>');
    var panel = el('section', { id: 'ita-panel', role: 'dialog', 'aria-label': 'IT assistant chat', hidden: '' });
    panel.innerHTML =
      '<div id="ita-head"><span class="ita-mini">' + AVATAR + '</span><div class="ita-grow"><strong>IT Assistant</strong><small>Ask about tasks, priorities and IT news</small></div>' +
      '<button type="button" id="ita-mute" aria-label="Mute voice" title="Mute voice">&#128266;</button>' +
      '<button type="button" id="ita-close" aria-label="Close chat">&#10005;</button></div>' +
      '<div id="ita-log" role="log" aria-live="polite"></div>' +
      '<div id="ita-chips"></div>' +
      '<form id="ita-form" autocomplete="off"><input id="ita-input" type="text" placeholder="Type your question…" aria-label="Your question" maxlength="200"><button type="submit">Send</button></form>';
    root.appendChild(panel); root.appendChild(btn); document.body.appendChild(root);

    var log = panel.querySelector('#ita-log'), input = panel.querySelector('#ita-input'), badge = btn.querySelector('#ita-badge');

    function add(text, who, sources) {
      var m = el('div', { 'class': 'ita-msg ita-' + who });
      m.textContent = text;
      if (sources && sources.length) { var s = el('span', { 'class': 'ita-src' }); s.textContent = 'Source: ' + sources.join('; '); m.appendChild(document.createElement('br')); m.appendChild(s); }
      log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    function ask(q) {
      q = q.trim(); if (!q) return;
      add(q, 'user');
      var a = answer(q);
      setTimeout(function () { add(a.text, 'bot', a.sources); }, REDUCED ? 0 : 350);
    }

    var chips = panel.querySelector('#ita-chips');
    ['When is the IT meeting?', 'How many tasks are overdue?', 'How do I add a task?', 'What does Blocked mean?'].forEach(function (q) {
      var b = el('button', { type: 'button' }); b.textContent = q; b.addEventListener('click', function () { ask(q); }); chips.appendChild(b);
    });

    var greeted = false;
    function open() {
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); badge.hidden = true;
      if (!greeted) { add(GREETING, 'bot'); greeted = true; }
      speak(GREETING); // voice message on every click that opens the chat
      input.focus();
    }
    function close() {
      panel.hidden = true; btn.setAttribute('aria-expanded', 'false');
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      btn.focus();
    }

    btn.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
    panel.querySelector('#ita-close').addEventListener('click', close);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    panel.querySelector('#ita-mute').addEventListener('click', function (e) {
      muted = !muted; e.currentTarget.innerHTML = muted ? '&#128263;' : '&#128266;';
      e.currentTarget.setAttribute('aria-label', muted ? 'Unmute voice' : 'Mute voice');
      if (muted) { try { window.speechSynthesis.cancel(); } catch (x) { /* ignore */ } }
    });
    panel.querySelector('#ita-form').addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); input.value = ''; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
