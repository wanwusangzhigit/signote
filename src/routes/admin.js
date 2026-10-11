// src/routes/admin.js
// Admin panel + management APIs.

import { DB } from '../db.js';
import { html, json, readJson, parseTtl, nowSec, getLang } from '../utils.js';
import {
  adminEnabled,
  isAdmin,
  createAdminToken,
  adminCookieHeader,
  adminLogoutHeader,
  hashNotePassword,
} from '../auth.js';
import { clientIp, deviceFingerprint, userAgent } from '../middleware.js';
import { adminPage } from '../pages/admin.js';

// ---- GET /admin ----
export async function handleAdminPage(env, req) {
  if (!adminEnabled(env)) {
    return html('<p style="font-family:sans-serif;padding:40px;text-align:center;">Admin panel is disabled. Set the <code>ADMIN_PASSWORD</code> secret to enable it.</p>');
  }
  const authed = await isAdmin(req, env);
  const db = new DB(env.DB);
  const maxChars = authed ? await db.getMaxChars() : 0;
  const randomIdLen = authed ? await db.getRandomIdLen() : 0;
  const contactEmail = authed ? await db.getContactEmail() : '';
  const lang = getLang(req);
  return html(adminPage(authed, { maxChars, randomIdLen, contactEmail }, lang));
}

// ---- POST /admin/login ----
export async function handleAdminLogin(env, req) {
  if (!adminEnabled(env)) return json({ error: 'admin disabled' }, 403);
  const body = await readJson(req);
  if (body.password !== env.ADMIN_PASSWORD) {
    return json({ error: 'invalid password' }, 401);
  }
  const token = await createAdminToken(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': adminCookieHeader(token),
    },
  });
}

// ---- POST /admin/logout ----
export function handleAdminLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': adminLogoutHeader(),
    },
  });
}

/** Guard for API routes: returns a 403 response if not admin, else null. */
async function guard(env, req) {
  if (!adminEnabled(env)) return json({ error: 'admin disabled' }, 403);
  if (!(await isAdmin(req, env))) return json({ error: 'unauthorized' }, 401);
  return null;
}

// ---- GET /admin/api/notes ----
export async function handleAdminListNotes(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const db = new DB(env.DB);
  const notes = await db.listNotes(500);
  return json({ notes });
}

// ---- GET /admin/api/notes/:id ---- (full note including content)
export async function handleAdminGetNote(env, req, id) {
  const g = await guard(env, req);
  if (g) return g;
  const db = new DB(env.DB);
  const note = await db.getNote(id);
  if (!note) return json({ error: 'not found' }, 404);
  return json({ note });
}

// ---- POST /admin/api/notes/:id/update ---- (modify any properties)
export async function handleAdminUpdateNote(env, req, id) {
  const g = await guard(env, req);
  if (g) return g;
  const db = new DB(env.DB);
  const note = await db.getNote(id);
  if (!note) return json({ error: 'not found' }, 404);
  const body = await readJson(req);

  // Build update fields from body; only provided fields are passed through.
  const fields = { id };
  if (typeof body.content === 'string') fields.content = body.content;
  if (body.password !== undefined) {
    // '' or null => remove password; string => set (hash it)
    if (body.password === '' || body.password == null) fields.password = '';
    else fields.password = await hashNotePassword(String(body.password));
  }
  if (body.readonly !== undefined) fields.readonly = !!body.readonly;
  if (body.ttl !== undefined) {
    const ttl = parseTtl(body.ttl);
    if (ttl != null) fields.expires_at = nowSec() + ttl;
    else if (body.ttl === '' || body.ttl === null) fields.expires_at = null;
  }
  if (body.title !== undefined) fields.title = body.title === '' ? '' : String(body.title).slice(0, 200);
  if (body.filename !== undefined) fields.filename = body.filename === '' ? '' : String(body.filename).slice(0, 200);
  if (body.lang !== undefined) fields.lang = body.lang === '' ? '' : String(body.lang).slice(0, 50);
  fields.ip = clientIp(req);

  await db.updateNote(fields);
  await db.logNote({ note_id: id, action: 'admin-update', ip: clientIp(req), ua: userAgent(req), fingerprint: await deviceFingerprint(req) });
  return json({ ok: true, id });
}

// ---- POST /admin/api/notes/delete ----
export async function handleAdminDeleteNotes(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').map((x) => x.toLowerCase()) : [];
  if (ids.length === 0) return json({ error: 'no ids' }, 400);
  const db = new DB(env.DB);
  const toDelete = ids.slice(0, 500);
  const n = await db.deleteNotes(toDelete);
  // audit: one log entry per deleted note
  const ip = clientIp(req);
  const ua = userAgent(req);
  const fp = await deviceFingerprint(req);
  await Promise.all(toDelete.map((id) => db.logNote({ note_id: id, action: 'delete', ip, ua, fingerprint: fp })));
  return json({ ok: true, deleted: n });
}

// ---- GET /admin/api/settings ----
export async function handleAdminGetSettings(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const db = new DB(env.DB);
  return json({
    max_chars: await db.getMaxChars(),
    random_id_len: await db.getRandomIdLen(),
    contact_email: await db.getContactEmail(),
  });
}

// ---- POST /admin/api/settings ----
export async function handleAdminSetSettings(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const body = await readJson(req);
  const db = new DB(env.DB);
  if (body.max_chars != null) {
    const n = parseInt(body.max_chars, 10);
    if (!Number.isFinite(n) || n < 1) return json({ error: 'invalid max_chars' }, 400);
    await db.setSetting('max_chars', String(n));
  }
  if (body.random_id_len != null) {
    const n = parseInt(body.random_id_len, 10);
    if (!Number.isFinite(n) || n < 2 || n > 32) return json({ error: 'random_id_len must be 2-32' }, 400);
    await db.setSetting('random_id_len', String(n));
  }
  if (body.contact_email != null) {
    await db.setSetting('contact_email', String(body.contact_email).slice(0, 200));
  }
  return json({
    ok: true,
    max_chars: await db.getMaxChars(),
    random_id_len: await db.getRandomIdLen(),
    contact_email: await db.getContactEmail(),
  });
}

// ---- GET /admin/api/ips ----
export async function handleAdminListIps(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const db = new DB(env.DB);
  const bans = await db.listBans();
  return json({ bans });
}

// ---- POST /admin/api/ips/ban ----
export async function handleAdminBanIp(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const body = await readJson(req);
  const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
  if (!ip) return json({ error: 'ip required' }, 400);
  const ttl = parseTtl(body.ttl);
  const expiresAt = ttl != null ? nowSec() + ttl : null;
  const db = new DB(env.DB);
  await db.banIp({ ip, reason: body.reason || null, expires_at: expiresAt });
  return json({ ok: true, ip, expires_at: expiresAt });
}

// ---- POST /admin/api/ips/unban ----
export async function handleAdminUnbanIp(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const body = await readJson(req);
  const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
  if (!ip) return json({ error: 'ip required' }, 400);
  const db = new DB(env.DB);
  const n = await db.unbanIp(ip);
  return json({ ok: true, removed: n });
}

// ---- GET /admin/api/logs?note_id=xxx ----
export async function handleAdminListLogs(env, req) {
  const g = await guard(env, req);
  if (g) return g;
  const url = new URL(req.url);
  const noteId = url.searchParams.get('note_id') || null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000);
  const db = new DB(env.DB);
  const logs = await db.listLogs({ note_id: noteId, limit });
  return json({ logs });
}
