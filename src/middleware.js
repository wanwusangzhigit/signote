// src/middleware.js
// Client-IP extraction, device fingerprint, and IP-ban enforcement.

import { nowSec, sha256Hex } from './utils.js';

/** Best-effort client IP. Cloudflare sets cf-connecting-ip on the edge. */
export function clientIp(req) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}

/**
 * Server-side device fingerprint: sha256(IP + UA + Accept-Language).
 * Works for both browser and curl (no client JS needed). Stable per
 * network+browser; changes when the user switches network or browser.
 */
export async function deviceFingerprint(req) {
  const ip = clientIp(req) || '';
  const ua = req.headers.get('user-agent') || '';
  const al = req.headers.get('accept-language') || '';
  return await sha256Hex(`${ip}\x1f${ua}\x1f${al}`);
}

/** User-Agent (normalized to empty string). */
export function userAgent(req) {
  return req.headers.get('user-agent') || '';
}

/**
 * Returns null if the IP is allowed, otherwise a 403 Response.
 * Bans with expires_at in the past are treated as expired (skipped).
 */
export async function enforceIpBan(db, ip) {
  if (!ip) return null;
  const ban = await db.getBan(ip);
  if (!ban) return null;
  if (ban.expires_at != null && ban.expires_at < nowSec()) {
    return null; // expired
  }
  const reason = ban.reason ? ` — ${ban.reason}` : '';
  return new Response(`Your IP (${ip}) has been banned${reason}.`, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '0' },
  });
}

