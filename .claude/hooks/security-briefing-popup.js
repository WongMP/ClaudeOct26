/**
 * Security briefing popup.
 *
 * After a visitor has spent 10 seconds on the page (time with the tab visible),
 * shows a modal reminding them of the mandatory IT security briefing.
 * Shown once per browser session.
 *
 * Usage: <script src="../.claude/hooks/security-briefing-popup.js" defer></script>
 * Colours follow the host page's CSS tokens (--surface, --text, --negative, ...) when present.
 */
(function () {
  var DELAY_MS = 10000;
  var STORAGE_KEY = 'itSecurityBriefingShown';
  var MESSAGE = 'There is an IT security briefing at Town Hall on Wed 10am. Attendance is mandatory.';

  function alreadyShown() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function markShown() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* storage unavailable */ }
  }

  function showDialog() {
    markShown();

    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'it-briefing-title');
    dialog.style.cssText =
      'max-width:420px;width:calc(100% - 32px);padding:24px;border:none;border-radius:12px;' +
      'box-shadow:var(--shadow-float,0 10px 40px rgba(0,0,0,.3));font-family:var(--font,system-ui,sans-serif);' +
      'color:var(--text,#1a1a1a);background:var(--surface,#fff);';
    dialog.innerHTML =
      '<h2 id="it-briefing-title" style="margin:0 0 12px;font-size:1.25rem;">&#9888; IT Security Briefing</h2>' +
      '<p style="margin:0 0 20px;line-height:1.5;"></p>' +
      '<div style="text-align:right;"><button type="button" style="padding:8px 20px;border:none;' +
      'border-radius:var(--radius-control,6px);background:var(--negative,#c62828);color:#fff;font:inherit;' +
      'font-weight:500;cursor:pointer;">Got it</button></div>';
    dialog.querySelector('p').textContent = MESSAGE;
    dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { dialog.remove(); });

    document.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.remove();
      window.alert(MESSAGE);
    }
  }

  function start() {
    if (alreadyShown()) return;

    // Only count time while the tab is visible.
    var remaining = DELAY_MS;
    var startedAt = null;
    var timer = null;

    function resume() {
      if (timer || document.hidden) return;
      startedAt = Date.now();
      timer = setTimeout(function () {
        timer = null;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        showDialog();
      }, remaining);
    }

    function pause() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      remaining -= Date.now() - startedAt;
    }

    function onVisibilityChange() {
      document.hidden ? pause() : resume();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    resume();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
