// src/utils.js
// Small shared helpers: hashing, escaping, time, responses.

/** Current unix time in seconds. */
export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/** SHA-256 hex digest (lowercase). */
export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Escape a string for safe inclusion in HTML text. */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for embedding inside a JS string literal (single-quoted). */
export function escapeJs(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Parse a TTL string like "1h", "7d", "30m", "3600" into seconds. Returns null if invalid/unset. */
export function parseTtl(input) {
  if (input == null || input === '') return null;
  const s = String(input).trim().toLowerCase();
  // plain seconds
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  const m = s.match(/^(\d+)\s*(s|m|h|d|w|y)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 }[m[2]];
  const sec = n * unit;
  return sec > 0 ? sec : null;
}

/** Simple JSON response helper. */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** HTML response helper. */
export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

/** Read JSON body safely, returning {} on failure. */
export async function readJson(req) {
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return {};
    const v = await req.json();
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Resolve site language from the nm_lang cookie. Returns 'en' or 'zh'. */
export function getLang(req) {
  const ck = req.headers.get('cookie') || '';
  const m = ck.match(/(?:^|;\s*)nm_lang=(zh|en)\b/);
  return m ? m[1] : 'en';
}
