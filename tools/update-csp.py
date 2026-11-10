#!/usr/bin/env python3
"""Rewrite the Content-Security-Policy meta tag in index.html with fresh SHA-256 hashes
of the inline <style> and <script> blocks. Run after any edit to either block:
    python3 tools/update-csp.py [path/to/index.html]
"""
import base64, hashlib, re, sys

path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
html = open(path, encoding="utf-8").read()

def digest(block: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(block.encode("utf-8")).digest()).decode() + "'"

style = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
script = re.search(r"<script>(.*?)</script>", html, re.S).group(1)

policy = "; ".join([
    "default-src 'none'",
    f"script-src {digest(script)}",
    f"style-src {digest(style)}",
    "style-src-attr 'unsafe-inline'",          # generated avatar colours and status-bar widths
    "connect-src https://formsubmit.co https://generativelanguage.googleapis.com",
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
])

new, n = re.subn(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)', lambda m: m.group(1) + policy + m.group(2), html)
if n != 1:
    sys.exit("CSP meta tag not found")
open(path, "w", encoding="utf-8").write(new)
print("CSP updated:", policy)
