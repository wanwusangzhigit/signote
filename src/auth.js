// src/auth.js
// Admin authentication + note password helpers.
// Admin password comes from env.ADMIN_PASSWORD (set via `wrangler secret put`).
// We never store the plaintext; we issue a short signed token stored in a cookie.

import { sha256Hex, nowSec } from './utils.js';

const ADMIN_COOKIE = 'nm_admin';
const TOKEN_TTL = 7 * 24 * 3600; // 7 days

/** Admin enabled only when a password secret is configured. */
export function adminEnabled(env) {
  return typeof env?.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0;
}

/** Build an HMAC-SHA256 hex for the given message using the admin password as key. */
async function sign(msg, env) {
  const enc = new TextEncoder();
  const keyData = enc.encode(env.ADMIN_PASSWORD);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a signed admin token: "expiry:hmac". */
export async function createAdminToken(env) {
  const exp = nowSec() + TOKEN_TTL;
  const sig = await sign(String(exp), env);
  return `${exp}:${sig}`;
}

/** Verify a token string. Returns true if valid and not expired. */
export async function verifyAdminToken(token, env) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split(':');
  if (!exp || !sig) return false;
  if (parseInt(exp, 10) < nowSec()) return false;
  const expected = await sign(exp, env);
  if (expected.length !== sig.length) return false;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Read the admin token from the request cookie. */
export function getAdminToken(req) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|; )${ADMIN_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Validate admin access. Returns true if request carries a valid admin token. */
export async function isAdmin(req, env) {
  if (!adminEnabled(env)) return false;
  // Allow header-based auth for curl/API usage too.
  const headerPw = req.headers.get('x-admin-password');
  if (headerPw && headerPw === env.ADMIN_PASSWORD) return true;
  return await verifyAdminToken(getAdminToken(req), env);
}

/** Set-Cookie header value for the admin token. */
export function adminCookieHeader(token) {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL}`;
}

export function adminLogoutHeader() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ---- note passwords ----

export async function hashNotePassword(plain) {
  if (plain == null || plain === '') return null;
  return await sha256Hex(plain);
}

export async function verifyNotePassword(plain, hash) {
  if (!hash) return true; // no password set
  if (plain == null) return false;
  return (await sha256Hex(plain)) === hash;
}
