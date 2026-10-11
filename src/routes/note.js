// src/routes/note.js
// All note-related routes: /:id, /:id/content, /:id/raw, /:id/img, /:id/put
//
// Write authorization rules (simplified):
//   - note does not exist      → create (anyone)
//   - note exists, expired     → overwrite (anyone); resets to a fresh note
//   - note exists, not expired,
//       readonly = 1           → nobody may edit (frozen until expiry)
//   - note exists, not expired,
//       has password            → only correct current_password may edit
//   - note exists, not expired,
//       no password, not readonly → anyone may edit (open)
//
// Guarantee: after a certain time, someone must be able to modify.
//   - password or readonly without an explicit TTL auto-defaults to 30 days,
//     ensuring the lock eventually expires and the note becomes overwritable.
// Max TTL = 30 days.

import { DB } from '../db.js';
import { html, json, parseTtl, nowSec, escapeHtml, getLang } from '../utils.js';
import { hashNotePassword, verifyNotePassword } from '../auth.js';
import { notePage } from '../pages/note.js';
import { clientIp, deviceFingerprint, userAgent } from '../middleware.js';

const MAX_ID_LEN = 128;
const ID_RE = /^[A-Za-z0-9._-]+$/;
const MAX_TTL = 30 * 86400; // 30 days in seconds
const MAX_META_LEN = 200;   // max length for title / filename

/** Validate the id path segment. */
function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LEN && ID_RE.test(id);
}

/**
 * Fetch a note and lazily mark it expired if past its TTL.
 * When expired, the content is cleared so it cannot be read (the page will
 * show an "expired" notice instead of stale content).
 * Returns { note, expired } or { note: null } if not found.
 */
async function resolveNote(db, id) {
  const note = await db.getNote(id);
  if (!note) return { note: null };
  if (note.expires_at != null && note.expires_at < nowSec()) {
    await db.markExpired(id);
    note.status = 'expired';
    note.content = '';
  }
  return { note, expired: note.status === 'expired' };
}

/** Build the metadata object embedded in the note page. */
function pageMeta(id, note) {
  if (!note) return { id, exists: false, hasPassword: false, expired: false, expiresAt: null, title: null, filename: null, lang: null, readonly: false };
  return {
    id,
    exists: true,
    hasPassword: !!note.password,
    expired: note.status === 'expired',
    expiresAt: note.expires_at ?? null,
    title: note.title ?? null,
    filename: note.filename ?? null,
    lang: note.lang ?? null,
    readonly: !!note.readonly,
  };
}

// ---- GET /:id ----
export async function handleNotePage(env, req, id) {
  if (!validId(id)) return new Response('Invalid note id.', { status: 400 });
  const db = new DB(env.DB);
  const { note } = await resolveNote(db, id);
  const lang = getLang(req);
  return html(notePage(pageMeta(id, note), lang));
}

// ---- GET /:id/content ----
export async function handleNoteContent(env, req, id) {
  if (!validId(id)) return json({ error: 'invalid id' }, 400);
  const db = new DB(env.DB);
  const { note, expired } = await resolveNote(db, id);
  if (!note) return json({ error: 'not found' }, 404);
  if (expired) return json({ error: 'expired' }, 410);
  const url = new URL(req.url);
  const pw = url.searchParams.get('password');
  if (!(await verifyNotePassword(pw, note.password))) {
    return json({ error: 'password required' }, 403);
  }
  await db.incrementViews(id);
  await db.logNote({ note_id: id, action: 'content', ip: clientIp(req), ua: userAgent(req), fingerprint: await deviceFingerprint(req) });
  return json({
    content: note.content,
    expiresAt: note.expires_at ?? null,
    hasPassword: !!note.password,
    title: note.title ?? null,
    filename: note.filename ?? null,
    lang: note.lang ?? null,
    readonly: !!note.readonly,
  });
}

// ---- POST /:id (save from web editor) — supports partial updates ----
//   body: { content?, password?, ttl?, current_password?, title?, filename?, lang?, readonly? }
//   current_password authenticates against the existing note password.
export async function handleNoteSave(env, req, id) {
  if (!validId(id)) return json({ error: 'invalid id' }, 400);
  const db = new DB(env.DB);
  const maxChars = await db.getMaxChars();
  const body = await req.json().catch(() => ({}));
  const ip = clientIp(req);
  const ua = userAgent(req);
  const fp = await deviceFingerprint(req);

  const { note, expired } = await resolveNote(db, id);

  // content: only update if explicitly provided as a string
  const content = typeof body.content === 'string' ? body.content : note ? note.content : '';
  if (content.length > maxChars) {
    return json({ error: `content exceeds max ${maxChars} chars` }, 413);
  }

  // password (the NEW password to set): undefined => keep; '' => remove; string => set
  let pwHash;
  if (body.password === undefined) pwHash = undefined;
  else if (body.password === '' || body.password == null) pwHash = '';
  else pwHash = await hashNotePassword(String(body.password));

  // readonly: undefined => keep; false => clear; true => set
  let readonlyVal;
  if (body.readonly === undefined) readonlyVal = undefined;
  else readonlyVal = !!body.readonly;

  // ttl
  const ttl = parseTtl(body.ttl);
  if (ttl != null && ttl > MAX_TTL) return json({ error: 'ttl must be <= 30 days' }, 400);
  const ttlSet = ttl != null;

  // title / filename / lang: undefined => keep; '' => clear; string => set (max MAX_META_LEN)
  function pickMeta(v) {
    if (v === undefined) return undefined;
    if (v == null || v === '') return '';
    return String(v).slice(0, MAX_META_LEN);
  }
  const title = pickMeta(body.title);
  const filename = pickMeta(body.filename);
  const lang = pickMeta(body.lang);

  // effective password / readonly after this write
  let effectivePw;
  if (pwHash === undefined) effectivePw = note ? note.password : null;
  else if (pwHash === '') effectivePw = null;
  else effectivePw = pwHash;

  let effectiveReadonly;
  if (readonlyVal === undefined) effectiveReadonly = note ? !!note.readonly : false;
  else effectiveReadonly = readonlyVal;

  // readonly requires an explicit TTL (the operation is irreversible, so the
  // user must choose when it expires). Password still auto-defaults to 30 days
  // if no TTL is given.
  let expiresAt;
  if (ttlSet) {
    expiresAt = nowSec() + ttl;
  } else if (!note || expired) {
    // new or overwrite
    if (effectiveReadonly) {
      return json({ error: 'readonly requires an expiry time' }, 400);
    }
    expiresAt = effectivePw != null ? nowSec() + MAX_TTL : null;
  } else {
    // existing note
    if (effectiveReadonly && note.expires_at == null) {
      return json({ error: 'readonly requires an expiry time' }, 400);
    }
    if (effectivePw != null && note.expires_at == null) {
      expiresAt = nowSec() + MAX_TTL;
    } else {
      expiresAt = note.expires_at;
    }
  }

  // authorization for existing non-expired notes:
  if (note && !expired) {
    // read-only notes: nobody can edit (not even the creator)
    if (note.readonly) {
      return json({ error: 'this note is read-only' }, 403);
    }
    // password-protected notes: require correct current_password
    if (note.password) {
      const cp = body.current_password;
      if (cp == null || !(await verifyNotePassword(String(cp), note.password))) {
        return json({ error: 'correct current password required to modify' }, 403);
      }
    }
    // no password, not readonly → anyone may edit
  }

  // creator_fp: recorded for audit/logging on first creation or overwrite
  let creatorFp;
  if (!note || expired) {
    creatorFp = fp;
  } else {
    creatorFp = undefined; // keep
  }

  if (!note || expired) {
    const hash = pwHash === undefined ? null : pwHash === '' ? null : pwHash;
    if (expired) {
      await db.updateNote({ id, content, password: pwHash ?? '', expires_at: expiresAt, ip, creator_fp: creatorFp, title, filename, lang, readonly: readonlyVal ?? false });
      await db.logNote({ note_id: id, action: 'overwrite', ip, ua, fingerprint: fp });
    } else {
      await db.insertNote({ id, content, password: hash, expires_at: expiresAt, ip, creator_fp: creatorFp, title, filename, lang, readonly: readonlyVal ?? false });
      await db.logNote({ note_id: id, action: 'create', ip, ua, fingerprint: fp });
    }
  } else {
    await db.updateNote({ id, content, password: pwHash, expires_at: expiresAt, ip, creator_fp: creatorFp, title, filename, lang, readonly: readonlyVal });
    await db.logNote({ note_id: id, action: 'update', ip, ua, fingerprint: fp });
  }
  return json({ ok: true, id });
}

// ---- GET /:id/raw ----
export async function handleNoteRaw(env, req, id) {
  if (!validId(id)) return new Response('Invalid note id.', { status: 400 });
  const db = new DB(env.DB);
  const { note, expired } = await resolveNote(db, id);
  if (!note) return new Response('Not found.', { status: 404 });
  if (expired) return new Response('This note has expired.', { status: 410 });
  const url = new URL(req.url);
  const pw = url.searchParams.get('password');
  if (!(await verifyNotePassword(pw, note.password))) {
    return new Response('Password required.', { status: 403 });
  }
  await db.incrementViews(id);
  await db.logNote({ note_id: id, action: 'raw', ip: clientIp(req), ua: userAgent(req), fingerprint: await deviceFingerprint(req) });
  return new Response(note.content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}

// ---- GET /:id/img (SVG) ----
export async function handleNoteImg(env, req, id) {
  if (!validId(id)) return new Response('Invalid note id.', { status: 400 });
  const db = new DB(env.DB);
  const { note, expired } = await resolveNote(db, id);
  if (!note) return new Response('Not found.', { status: 404 });
  if (expired) return new Response('This note has expired.', { status: 410 });
  const url = new URL(req.url);
  const pw = url.searchParams.get('password');
  if (!(await verifyNotePassword(pw, note.password))) {
    return new Response('Password required.', { status: 403 });
  }
  await db.logNote({ note_id: id, action: 'img', ip: clientIp(req), ua: userAgent(req), fingerprint: await deviceFingerprint(req) });
  const bg = url.searchParams.get('bg') || '';
  const lang = note.lang || '';
  const svg = mdToSvg(note.content || '(empty)', id, bg, lang);
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=60' },
  });
}

// ---- GET /:id/dl — download note content as a file ----
// Uses the note's filename if set, otherwise falls back to the id. The download
// filename is sanitized: only alnum, dot, dash, underscore are kept.
export async function handleNoteDl(env, req, id) {
  if (!validId(id)) return new Response('Invalid note id.', { status: 400 });
  const db = new DB(env.DB);
  const { note, expired } = await resolveNote(db, id);
  if (!note) return new Response('Not found.', { status: 404 });
  if (expired) return new Response('This note has expired.', { status: 410 });
  const url = new URL(req.url);
  const pw = url.searchParams.get('password');
  if (!(await verifyNotePassword(pw, note.password))) {
    return new Response('Password required.', { status: 403 });
  }
  await db.logNote({ note_id: id, action: 'dl', ip: clientIp(req), ua: userAgent(req), fingerprint: await deviceFingerprint(req) });
  // sanitize filename: keep alnum, dot, dash, underscore; default to id
  let fname = (note.filename || id || 'note').replace(/[^A-Za-z0-9._-]/g, '');
  if (!fname) fname = id;
  // if the note has a language and the filename has no extension, add one
  if (note.lang && !/\.[A-Za-z0-9]+$/.test(fname)) {
    const ext = langExt(note.lang);
    if (ext) fname += '.' + ext;
  }
  const ctype = 'text/plain; charset=utf-8';
  // RFC 5987 encoded filename to support non-ASCII, plus ASCII fallback.
  const fallback = fname;
  const encoded = encodeURIComponent(fname);
  const cd = `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
  return new Response(note.content, {
    headers: {
      'Content-Type': ctype,
      'Content-Disposition': cd,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Map a highlight.js language id to a file extension (for /dl). */
function langExt(lang) {
  const m = {
    javascript: 'js', typescript: 'ts', python: 'py', go: 'go', rust: 'rs',
    java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', ruby: 'rb',
    bash: 'sh', shell: 'sh', sql: 'sql', html: 'html', css: 'css', json: 'json',
    yaml: 'yml', xml: 'xml', markdown: 'md', plaintext: 'txt', text: 'txt',
  };
  return m[lang] || null;
}

/**
 * Server-side Markdown → HTML renderer with inline styles (for SVG foreignObject).
 * SVG loaded as an image ignores <style> tags, so every element must have
 * inline styles. Preserves whitespace in code blocks via white-space:pre.
 */
function mdToHtml(src, S) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = src.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- code block (```lang ... ```) ---
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = highlightCode(codeLines.join('\n'), fence[1] || '', S._isDark);
      html += `<pre style="${S.pre}"><code style="${S.code}">${code}</code></pre>`;
      continue;
    }

    // --- block math $$...$$ ---
    const blockMathFull = line.match(/^\s*\$\$(.*)\$\$\s*$/);
    const blockMathStart = line.match(/^\s*\$\$\s*$/);
    if (blockMathFull || blockMathStart) {
      const mathLines = [];
      if (blockMathFull) {
        mathLines.push(blockMathFull[1]);
      } else {
        i++;
        while (i < lines.length && !lines[i].match(/^\s*\$\$\s*$/)) {
          mathLines.push(lines[i]);
          i++;
        }
        i++; // skip closing $$
      }
      let mathContent = mathLines.join('\n');
      mathContent = esc(mathContent);
      // LaTeX line breaks \\ → <br/>
      mathContent = mathContent.replace(/\\\\\s*\n/g, '<br/>');
      mathContent = mathContent.replace(/\\\\$/gm, '<br/>');
      // Empty lines → paragraph break
      mathContent = mathContent.replace(/\n{2,}/g, '<br/><br/>');
      // Remaining newlines → <br/>
      mathContent = mathContent.replace(/\n/g, '<br/>');
      // User-written <br> tags (escaped as &lt;br&gt;) → <br/>
      mathContent = mathContent.replace(/&lt;br\s*\/?&gt;/gi, '<br/>');

      const mathBg = S._isDark ? '#161b22' : '#f6f8fa';
      const mathBorder = S._isDark ? '#30363d' : '#e5e7eb';
      const mathFg = S._isDark ? '#c9d1d9' : '#1f2328';
      html += `<div style="text-align:center;margin:1em 0;padding:12px 16px;background:${mathBg};border:1px solid ${mathBorder};border-radius:6px;font-family:'Times New Roman',Georgia,'Noto Serif SC',serif;font-size:1.05em;line-height:1.9;color:${mathFg};white-space:normal;">${mathContent}</div>`;
      continue;
    }

    // --- blank line ---
    if (line.trim() === '') { i++; continue; }

    // --- header ---
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const hs = S['h' + lvl] || S.h6;
      html += `<h${lvl} style="${hs}">${inlineMd(h[2], S)}</h${lvl}>`;
      i++;
      continue;
    }

    // --- horizontal rule ---
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += `<hr style="${S.hr}"/>`;
      i++;
      continue;
    }

    // --- blockquote ---
    if (line.match(/^>\s?/)) {
      const quoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote style="${S.blockquote}">${inlineMd(quoteLines.join(' '), S)}</blockquote>`;
      continue;
    }

    // --- unordered list ---
    if (line.match(/^[-*+]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        items.push(`<li style="${S.li}">${inlineMd(lines[i].replace(/^[-*+]\s+/, ''), S)}</li>`);
        i++;
      }
      html += `<ul style="${S.ul}">${items.join('')}</ul>`;
      continue;
    }

    // --- ordered list ---
    if (line.match(/^\d+\.\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(`<li style="${S.li}">${inlineMd(lines[i].replace(/^\d+\.\s+/, ''), S)}</li>`);
        i++;
      }
      html += `<ol style="${S.ol}">${items.join('')}</ol>`;
      continue;
    }

    // --- paragraph (collect consecutive non-special lines) ---
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].match(/^```/) && !lines[i].match(/^(#{1,6})\s/) &&
      !lines[i].match(/^>\s?/) && !lines[i].match(/^[-*+]\s/) &&
      !lines[i].match(/^\d+\.\s/) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !lines[i].match(/^\s*\$\$/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      html += `<p style="${S.p}">${inlineMd(paraLines.join('<br/>'), S)}</p>`;
    }
  }
  return html;
}

/** Inline markdown: code, bold, italic, links, inline math. Uses inline styles. */
function inlineMd(s, S) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Handle inline math $...$ BEFORE escaping, to extract raw math content
  // Use placeholder so escape doesn't affect it, and we restore styling after.
  let r = s.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g, (_, math) => {
    let mc = math.replace(/\\\n/g, '<br/>');
    return `__INLINE_MATH__${esc(mc)}__END_INLINE_MATH__`;
  });

  r = esc(r);

  // Restore inline math with serif font styling
  const mathFg = S._isDark ? '#c9d1d9' : '#1f2328';
  r = r.replace(/__INLINE_MATH__(.+?)__END_INLINE_MATH__/g,
    `<span style="font-family:'Times New Roman',Georgia,'Noto Serif SC',serif;font-style:italic;color:${mathFg};">$1</span>`);

  // inline code
  r = r.replace(/`([^`]+)`/g, (_, c) => `<code style="${S.inlineCode}">${c}</code>`);
  // bold
  r = r.replace(/\*\*([^*]+)\*\*/g, `<strong style="${S.strong}">$1</strong>`);
  r = r.replace(/__([^_]+)__/g, `<strong style="${S.strong}">$1</strong>`);
  // italic
  r = r.replace(/\*([^*]+)\*/g, `<em style="${S.em}">$1</em>`);
  // links
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${S.a}">$1</a>`);
  return r;
}

/**
 * Simple server-side syntax highlighter.
 * Tokenizes code into keywords, strings, comments, numbers, and functions.
 * Returns HTML with colored <span> elements using inline styles.
 */
function highlightCode(code, lang, isDark) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Color palette — GitHub dark/light theme inspired
  const C = isDark
    ? { kw: '#ff7b72', str: '#a5d6ff', cmt: '#8b949e', num: '#79c0ff', fn: '#d2a8ff', op: '#ff7b72', punct: '#c9d1d9', plain: '#e6edf3' }
    : { kw: '#cf222e', str: '#0a3069', cmt: '#6e7781', num: '#0550ae', fn: '#8250df', op: '#cf222e', punct: '#24292f', plain: '#1f2328' };

  const kwSets = {
    javascript: ['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','void','delete','throw','try','catch','finally','async','await','yield','import','export','default','from','as','null','undefined','true','false','NaN','Infinity','static','get','set','public','private','protected'],
    typescript: ['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','void','delete','throw','try','catch','finally','async','await','yield','import','export','default','from','as','null','undefined','true','false','NaN','Infinity','static','get','set','public','private','protected','interface','type','enum','namespace','declare','readonly','abstract','implements','number','string','boolean','any','unknown','never','object','symbol','bigint','as','is','satisfies'],
    python: ['def','class','return','if','elif','else','for','while','break','continue','import','from','as','pass','None','True','False','and','or','not','in','is','lambda','try','except','finally','raise','with','yield','global','nonlocal','assert','del','async','await','self','cls','print','len','range','str','int','float','list','dict','set','tuple'],
    go: ['package','import','func','return','if','else','for','range','switch','case','default','break','continue','var','const','type','struct','interface','map','chan','go','defer','select','fallthrough','nil','true','false','make','len','cap','append','copy','delete','new','panic','recover','close'],
    rust: ['fn','let','mut','const','static','struct','enum','trait','impl','pub','priv','use','mod','return','if','else','for','while','loop','match','break','continue','as','in','ref','move','self','Self','super','crate','where','unsafe','async','await','dyn','type','union'],
    java: ['public','private','protected','class','interface','extends','implements','static','final','void','int','long','double','float','boolean','char','byte','short','String','return','if','else','for','while','do','switch','case','break','continue','new','this','super','try','catch','finally','throw','throws','import','package','null','true','false','instanceof','synchronized','abstract','volatile','transient','native','enum'],
    c: ['int','long','short','char','float','double','void','unsigned','signed','const','static','extern','register','volatile','auto','struct','union','enum','typedef','return','if','else','for','while','do','switch','case','break','continue','default','goto','sizeof','NULL','true','false','define','include','ifdef','ifndef','endif','pragma'],
    cpp: ['int','long','short','char','float','double','void','unsigned','signed','const','static','extern','register','volatile','auto','struct','union','enum','class','public','private','protected','template','typename','namespace','using','return','if','else','for','while','do','switch','case','break','continue','default','goto','sizeof','new','delete','this','virtual','override','final','nullptr','true','false','std','cout','cin','endl','include','define'],
    csharp: ['using','namespace','class','interface','struct','enum','public','private','protected','internal','static','readonly','const','virtual','override','abstract','sealed','partial','async','await','return','if','else','for','foreach','while','do','switch','case','break','continue','default','new','this','base','try','catch','finally','throw','null','true','false','var','void','int','long','short','byte','float','double','char','bool','string','object','decimal'],
    php: ['function','class','interface','extends','implements','public','private','protected','static','final','abstract','const','return','if','else','elseif','for','foreach','while','do','switch','case','break','continue','default','new','this','self','parent','try','catch','finally','throw','use','namespace','echo','print','isset','unset','empty','array','null','true','false','require','include','require_once','include_once','global','var'],
    ruby: ['def','end','class','module','if','elsif','else','unless','while','until','for','do','break','next','redo','retry','return','yield','begin','rescue','ensure','raise','throw','catch','require','require_relative','load','include','extend','attr_accessor','attr_reader','attr_writer','public','private','protected','self','super','nil','true','false','puts','print','p','new','lambda','proc','each','map','select','reduce','inject'],
    bash: ['if','then','else','elif','fi','for','while','until','do','done','case','esac','function','return','break','continue','exit','export','local','readonly','declare','unset','set','shift','echo','printf','read','source','alias','unalias','cd','pwd','ls','cat','grep','sed','awk','find','mkdir','rm','cp','mv','ln','chmod','chown','test','true','false','null'],
    sql: ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER','DROP','INDEX','VIEW','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','ON','GROUP','BY','HAVING','ORDER','LIMIT','OFFSET','DISTINCT','UNION','ALL','AS','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL','TRUE','FALSE','CASE','WHEN','THEN','ELSE','END','COUNT','SUM','AVG','MIN','MAX','ASC','DESC','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','CONSTRAINT','UNIQUE','CHECK'],
    css: ['color','background','background-color','margin','padding','border','display','position','width','height','font-size','font-family','font-weight','text-align','line-height','flex','grid','none','block','inline','absolute','relative','fixed','sticky','auto','inherit','initial','unset','solid','dashed','dotted','transparent','red','blue','green','black','white','left','right','top','bottom','center'],
    json: ['true','false','null'],
    html: [],
    yaml: ['true','false','null','yes','no','on','off'],
  };

  const langKey = (lang || '').toLowerCase();
  const keywords = kwSets[langKey] || [];
  const kwSet = new Set(keywords.map(k => k.toLowerCase()));

  // Tokenize: comments, strings, numbers, words, operators, whitespace
  // We process the code character by character to avoid overlapping matches.
  let result = '';
  let i = 0;
  const len = code.length;

  // Comment styles per language
  const lineComment = ['javascript','typescript','java','c','cpp','csharp','php','rust','go','css','yaml','bash'].includes(langKey) ? '//' : (['python','ruby','bash'].includes(langKey) ? '#' : null);
  const blockComment = ['javascript','typescript','java','c','cpp','csharp','php','rust','go','css'].includes(langKey) ? ['/*','*/'] : null;

  while (i < len) {
    // Block comment /* ... */
    if (blockComment && code.slice(i, i + 2) === blockComment[0]) {
      let end = code.indexOf(blockComment[1], i + 2);
      if (end === -1) end = len; else end += 2;
      const text = code.slice(i, end);
      result += `<span style="color:${C.cmt};font-style:italic;">${esc(text)}</span>`;
      i = end;
      continue;
    }
    // Line comment
    if (lineComment && code.slice(i, i + lineComment.length) === lineComment) {
      let end = code.indexOf('\n', i);
      if (end === -1) end = len;
      const text = code.slice(i, end);
      result += `<span style="color:${C.cmt};font-style:italic;">${esc(text)}</span>`;
      i = end;
      continue;
    }
    // String (double/single/backtick)
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < len) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === ch) { j++; break; }
        if (code[j] === '\n' && ch !== '`') break;
        j++;
      }
      const text = code.slice(i, j);
      result += `<span style="color:${C.str};">${esc(text)}</span>`;
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(ch) && (i === 0 || !/[a-zA-Z_]/.test(code[i - 1]))) {
      let j = i;
      while (j < len && /[0-9.xXa-fA-F_]/.test(code[j])) j++;
      const text = code.slice(i, j);
      result += `<span style="color:${C.num};">${esc(text)}</span>`;
      i = j;
      continue;
    }
    // Word (identifier/keyword)
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const lower = word.toLowerCase();
      // Check if next non-space char is '(' → function call
      let k = j;
      while (k < len && /\s/.test(code[k])) k++;
      const isFn = code[k] === '(';
      // SQL keywords are uppercase
      const isSqlKw = langKey === 'sql' && keywords.includes(word);
      if (isSqlKw || (kwSet.has(lower) && word === word.toLowerCase()) || (langKey === 'sql' && kwSet.has(lower) && word === word.toUpperCase())) {
        result += `<span style="color:${C.kw};font-weight:600;">${esc(word)}</span>`;
      } else if (isFn) {
        result += `<span style="color:${C.fn};">${esc(word)}</span>`;
      } else {
        result += esc(word);
      }
      i = j;
      continue;
    }
    // Punctuation/operators
    if (/[{}()\[\].,;:]/.test(ch)) {
      result += `<span style="color:${C.punct};">${esc(ch)}</span>`;
      i++;
      continue;
    }
    if (/[+\-*/%=<>!&|^~?@]/.test(ch)) {
      let j = i;
      while (j < len && /[+\-*/%=<>!&|^~?@]/.test(code[j])) j++;
      const text = code.slice(i, j);
      result += `<span style="color:${C.op};">${esc(text)}</span>`;
      i = j;
      continue;
    }
    // Whitespace and everything else
    result += esc(ch);
    i++;
  }
  return result;
}

/**
 * Render note content into an SVG image using foreignObject.
 * All elements use inline styles because SVG loaded as <img> ignores <style>.
 * Background is transparent by default; pass ?bg=COLOR to fill.
 */
function mdToSvg(text, id, bg, lang) {
  const isDark = bg && ['#0', '#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9'].some(c => bg.toLowerCase().startsWith(c));
  const fg = isDark ? '#e6edf3' : '#1a1a1a';
  const muted = isDark ? '#8b949e' : '#6b7280';
  const codeBg = isDark ? '#161b22' : '#f6f8fa';
  const border = isDark ? '#30363d' : '#e5e7eb';
  const linkColor = isDark ? '#58a6ff' : '#0969da';

  const S = {
    _isDark: isDark,
    pre: `margin:8px 0;padding:14px 16px;background:${codeBg};border:1px solid ${border};border-radius:6px;overflow:hidden;white-space:pre;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.5;`,
    code: `font-family:inherit;font-size:inherit;color:inherit;background:transparent;`,
    inlineCode: `font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:${codeBg};padding:1px 6px;border-radius:4px;font-size:.9em;`,
    h1: `font-size:1.6em;font-weight:600;margin:.8em 0 .4em;line-height:1.3;color:${fg};`,
    h2: `font-size:1.35em;font-weight:600;margin:.8em 0 .4em;line-height:1.3;color:${fg};`,
    h3: `font-size:1.15em;font-weight:600;margin:.8em 0 .4em;line-height:1.3;color:${fg};`,
    h4: `font-size:1em;font-weight:600;margin:.8em 0 .4em;color:${fg};`,
    h5: `font-size:.95em;font-weight:600;margin:.8em 0 .4em;color:${fg};`,
    h6: `font-size:.9em;font-weight:600;margin:.8em 0 .4em;color:${fg};`,
    p: `margin:0 0 .5em;line-height:1.7;color:${fg};`,
    ul: `margin:0 0 .5em;padding-left:1.5em;color:${fg};`,
    ol: `margin:0 0 .5em;padding-left:1.5em;color:${fg};`,
    li: `margin:0 0 .25em;line-height:1.6;color:${fg};`,
    blockquote: `border-left:3px solid ${border};margin:0 0 .5em;padding-left:14px;color:${muted};line-height:1.7;`,
    a: `color:${linkColor};text-decoration:none;`,
    hr: `border:none;border-top:1px solid ${border};margin:1em 0;`,
    strong: `font-weight:700;color:${fg};`,
    em: `font-style:italic;color:${fg};`,
  };

  // Build the inner HTML content
  let innerHtml;
  if (lang && lang !== 'markdown') {
    innerHtml = `<pre style="${S.pre}"><code style="${S.code}">${highlightCode(text, lang, isDark)}</code></pre>`;
  } else {
    innerHtml = mdToHtml(text, S);
  }

  const headerBar = `<div style="padding:8px 16px;background:${codeBg};border-bottom:1px solid ${border};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:${muted};">signote/${escapeHtml(id)}</div>`;
  const bgRect = bg ? `<rect width="100%" height="100%" fill="${escapeHtml(bg)}"/>` : '';

  const w = 820;
  const h = 1200;
  const wrapperStyle = `width:${w}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.7;color:${fg};`;
  const contentStyle = `padding:20px;white-space:pre-wrap;word-wrap:break-word;`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bgRect}
  <foreignObject x="0" y="0" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="${wrapperStyle}">
      ${headerBar}
      <div style="${contentStyle}">${innerHtml}</div>
    </div>
  </foreignObject>
</svg>`;
}

// ---- PUT/POST /:id/put (curl upload) ----
//   ?password=  auth password for existing protected notes; for new/overwrite
//              notes it also sets the note password (requires ?ttl=).
//   ?ttl=       expiry duration (<= 30d). On new notes records creator_fp.
export async function handleNotePut(env, req, id) {
  if (!validId(id)) return new Response('Invalid note id.', { status: 400 });
  const db = new DB(env.DB);
  const maxChars = await db.getMaxChars();

  const url = new URL(req.url);
  const ttl = parseTtl(url.searchParams.get('ttl'));
  if (ttl != null && ttl > MAX_TTL) return new Response('ttl must be <= 30 days\n', { status: 400 });
  const pwParam = url.searchParams.get('password');
  const ip = clientIp(req);
  const ua = userAgent(req);
  const fp = await deviceFingerprint(req);

  const content = await req.text();
  if (content.length > maxChars) {
    return new Response(`content exceeds max ${maxChars} chars\n`, { status: 413 });
  }

  const { note, expired } = await resolveNote(db, id);

  // PUT semantics: ?password= authenticates against an existing protected note;
  // for a new or overwritten note it also sets the password.
  let setPwHash; // the password to write on new/overwrite
  if (!note || expired) {
    if (pwParam) {
      setPwHash = await hashNotePassword(pwParam);
    } else {
      setPwHash = null;
    }
  }

  const ttlSet = ttl != null;
  // When overwriting an expired note without a new ttl, clear the stale expiry
  // (otherwise the note would immediately be re-marked expired).
  let expiresAt;
  if (ttlSet) expiresAt = nowSec() + ttl;
  else if (!note || expired) expiresAt = null;
  else expiresAt = note.expires_at;

  // Auto-default TTL to 30 days when setting a password without explicit TTL.
  if ((!note || expired) && setPwHash != null && expiresAt == null) {
    expiresAt = nowSec() + MAX_TTL;
  }

  // authorization for existing non-expired note
  if (note && !expired) {
    // read-only notes: nobody can edit
    if (note.readonly) {
      return new Response('This note is read-only.\n', { status: 403 });
    }
    // password-protected notes: require correct password
    if (note.password) {
      if (!pwParam || !(await verifyNotePassword(pwParam, note.password))) {
        return new Response('Correct password required to modify this note.\n', { status: 403 });
      }
    }
    // no password, not readonly → anyone may edit
  }

  if (!note || expired) {
    const creatorFp = expiresAt != null ? fp : null;
    if (expired) {
      // overwrite: replace all fields; clear stale password/creator_fp when not set.
      await db.updateNote({ id, content, password: setPwHash ?? '', expires_at: expiresAt, ip, creator_fp: creatorFp });
      await db.logNote({ note_id: id, action: 'overwrite', ip, ua, fingerprint: fp });
    } else {
      await db.insertNote({ id, content, password: setPwHash, expires_at: expiresAt, ip, creator_fp: creatorFp });
      await db.logNote({ note_id: id, action: 'put', ip, ua, fingerprint: fp });
    }
  } else {
    // existing non-expired: PUT replaces content; password unchanged (?password= is auth only);
    // ttl updated if provided; creator_fp recorded on first expiry.
    let creatorFp;
    if (ttlSet && note.expires_at == null && note.creator_fp == null) creatorFp = fp;
    else creatorFp = undefined;
    await db.updateNote({ id, content, expires_at: expiresAt, ip, creator_fp: creatorFp });
    await db.logNote({ note_id: id, action: 'put', ip, ua, fingerprint: fp });
  }
  return new Response(`saved /${id}\n`, {
    status: 201,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
