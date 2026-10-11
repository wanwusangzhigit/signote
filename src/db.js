// src/db.js
// Thin D1 wrapper + data-access helpers.
// All queries go through here so the schema surface stays in one place.

import { nowSec } from './utils.js';

export class DB {
  constructor(d1) {
    this.d1 = d1;
  }

  // ---- notes ----

  async getNote(id) {
    const stmt = this.d1.prepare(
      `SELECT id, content, password, expires_at, status, created_at, updated_at, ip, views, creator_fp, title, filename, lang, readonly
       FROM notes WHERE id = ?`
    );
    return await stmt.bind(id).first();
  }

  async insertNote({ id, content, password, expires_at, ip, creator_fp, title, filename, lang, readonly }) {
    const t = nowSec();
    await this.d1
      .prepare(
        `INSERT INTO notes (id, content, password, expires_at, status, created_at, updated_at, ip, views, creator_fp, title, filename, lang, readonly)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, ?, ?, ?, ?, ?)`
      )
      .bind(id, content, password ?? null, expires_at ?? null, t, t, ip ?? null, creator_fp ?? null, title ?? null, filename ?? null, lang ?? null, readonly ? 1 : 0)
      .run();
    return t;
  }

  /**
   * Partial update. Each of password / expires_at / creator_fp / title / filename / lang / readonly
   * is tri-state:
   *   undefined => leave unchanged
   *   null       => clear (set to NULL)
   *   string/number => set to this value
   * content and ip are always written (ip via COALESCE to keep old if null).
   */
  async updateNote({ id, content, password, expires_at, ip, creator_fp, title, filename, lang, readonly }) {
    const t = nowSec();
    const sets = ['content = ?', 'updated_at = ?', "ip = COALESCE(?, ip)", "status = 'active'"];
    const binds = [content, t, ip ?? null];
    if (expires_at !== undefined) { sets.push('expires_at = ?'); binds.push(expires_at); }
    if (password !== undefined) { sets.push('password = ?'); binds.push(password === '' ? null : password); }
    if (creator_fp !== undefined) { sets.push('creator_fp = ?'); binds.push(creator_fp); }
    if (title !== undefined) { sets.push('title = ?'); binds.push(title === '' ? null : title); }
    if (filename !== undefined) { sets.push('filename = ?'); binds.push(filename === '' ? null : filename); }
    if (lang !== undefined) { sets.push('lang = ?'); binds.push(lang === '' ? null : lang); }
    if (readonly !== undefined) { sets.push('readonly = ?'); binds.push(readonly ? 1 : 0); }
    binds.push(id);
    await this.d1.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return t;
  }

  /** Mark a note as expired (forbidden access) without deleting content. */
  async markExpired(id) {
    const t = nowSec();
    await this.d1
      .prepare(`UPDATE notes SET status = 'expired', updated_at = ? WHERE id = ?`)
      .bind(t, id)
      .run();
  }

  async incrementViews(id) {
    await this.d1.prepare(`UPDATE notes SET views = views + 1 WHERE id = ?`).bind(id).run();
  }

  async listNotes(limit = 200) {
    const res = await this.d1
      .prepare(
        `SELECT id, length(content) AS size, password IS NOT NULL AS has_password,
                expires_at, status, created_at, updated_at, ip, views, readonly
         FROM notes ORDER BY updated_at DESC LIMIT ?`
      )
      .bind(limit)
      .all();
    return res.results || [];
  }

  async deleteNotes(ids) {
    if (!ids || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const res = await this.d1
      .prepare(`DELETE FROM notes WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();
    return res.meta?.changes ?? 0;
  }

  // ---- settings ----

  async getSetting(key, fallback = null) {
    const row = await this.d1
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .bind(key)
      .first();
    return row ? row.value : fallback;
  }

  async setSetting(key, value) {
    await this.d1
      .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .bind(key, String(value))
      .run();
  }

  async getMaxChars() {
    const v = await this.getSetting('max_chars', '100000');
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 100000;
  }

  async getRandomIdLen() {
    const v = await this.getSetting('random_id_len', '4');
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 2 && n <= 32 ? n : 4;
  }

  async getContactEmail() {
    const v = await this.getSetting('contact_email', '');
    return v || '';
  }

  // ---- ip bans ----

  async getBan(ip) {
    return await this.d1
      .prepare(`SELECT ip, reason, created_at, expires_at FROM ip_bans WHERE ip = ?`)
      .bind(ip)
      .first();
  }

  async listBans() {
    const res = await this.d1
      .prepare(`SELECT ip, reason, created_at, expires_at FROM ip_bans ORDER BY created_at DESC`)
      .all();
    return res.results || [];
  }

  async banIp({ ip, reason, expires_at }) {
    const t = nowSec();
    await this.d1
      .prepare(
        `INSERT INTO ip_bans (ip, reason, created_at, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at, expires_at = excluded.expires_at`
      )
      .bind(ip, reason ?? null, t, expires_at ?? null)
      .run();
  }

  async unbanIp(ip) {
    const res = await this.d1.prepare(`DELETE FROM ip_bans WHERE ip = ?`).bind(ip).run();
    return res.meta?.changes ?? 0;
  }

  // ---- audit log ----

  async logNote({ note_id, action, ip, ua, fingerprint }) {
    const t = nowSec();
    await this.d1
      .prepare(
        `INSERT INTO note_logs (note_id, action, ip, ua, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(note_id, action, ip ?? null, ua ?? null, fingerprint ?? null, t)
      .run();
  }

  async listLogs({ note_id, limit = 200 } = {}) {
    const cap = Math.min(limit, 1000);
    if (note_id) {
      const res = await this.d1
        .prepare(
          `SELECT id, note_id, action, ip, ua, fingerprint, created_at
           FROM note_logs WHERE note_id = ? ORDER BY created_at DESC LIMIT ?`
        )
        .bind(note_id, cap)
        .all();
      return res.results || [];
    }
    const res = await this.d1
      .prepare(
        `SELECT id, note_id, action, ip, ua, fingerprint, created_at
         FROM note_logs ORDER BY created_at DESC LIMIT ?`
      )
      .bind(cap)
      .all();
    return res.results || [];
  }
}
