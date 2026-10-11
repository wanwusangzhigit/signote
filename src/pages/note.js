// src/pages/note.js
// Note page served at GET /:id
// Embed only metadata; content is fetched client-side (so password-protected notes
// never leak their content in the initial HTML).

import { escapeHtml, escapeJs } from '../utils.js';

const I18N = {
  en: {
    edit: 'Edit', preview: 'Preview', settings: 'Settings', save: 'Save',
    raw: 'raw', img: 'img', dl: 'dl',
    pwTitle: 'This note is password protected',
    pwPlaceholder: 'Enter password', pwUnlock: 'Unlock', pwWrong: 'Wrong password.',
    expired: 'This note has expired', expiredSub: 'It is no longer accessible.',
    expiredClear: 'Clear & create new', expiredClearing: 'Clearing...',
    expiredCleared: 'Cleared. Reload to create a new note.',
    expiredClearFail: 'Clear failed: ',
    newNote: 'New note — write something and hit Save.',
    saved: 'Saved.', saveFail: 'Save failed: ',
    settingsTitle: 'Note settings',
    ttl: 'Retention (TTL)', ttlForever: 'Forever',
    password: 'Password (requires expiry; leave empty to remove)',
    title: 'Page title', titlePh: 'optional',
    filename: 'Download filename', filenamePh: 'e.g. notes.txt',
    language: 'Text language', langAuto: 'Auto (markdown)',
    saveSettings: 'Save settings', close: 'Close',
    settingsSaved: 'Settings saved.',
    readonly: 'Read-only (nobody can edit until expiry)',
    readonlyWarn: 'Warning: making a note read-only is irreversible. You will not be able to edit it until it expires.',
    readonlyNeedsTtl: 'Read-only requires selecting an expiry time.',
    readonlyBadge: 'Read-only',
    readonlyLocked: 'This note is read-only. Editing is locked until expiry.',
  },
  zh: {
    edit: '编辑', preview: '预览', settings: '设置', save: '保存',
    raw: '原文', img: '图片', dl: '下载',
    pwTitle: '此笔记受密码保护',
    pwPlaceholder: '输入密码', pwUnlock: '解锁', pwWrong: '密码错误。',
    expired: '此笔记已过期', expiredSub: '无法再访问。',
    expiredClear: '清空并新建', expiredClearing: '清空中…',
    expiredCleared: '已清空。刷新页面即可新建空白笔记。',
    expiredClearFail: '清空失败：',
    newNote: '新笔记 — 写点什么然后点保存。',
    saved: '已保存。', saveFail: '保存失败：',
    settingsTitle: '笔记设置',
    ttl: '保留时间 (TTL)', ttlForever: '永久',
    password: '密码（需设过期时间；留空移除）',
    title: '页面标题', titlePh: '可选',
    filename: '下载文件名', filenamePh: '例如 notes.txt',
    language: '文本语言', langAuto: '自动（Markdown）',
    saveSettings: '保存设置', close: '关闭',
    settingsSaved: '设置已保存。',
    readonly: '只读（到期前任何人不可编辑）',
    readonlyWarn: '警告：设为只读后不可撤销，到期前将无法编辑。',
    readonlyNeedsTtl: '只读必须选择过期时间。',
    readonlyBadge: '只读',
    readonlyLocked: '此笔记为只读状态，到期前编辑已锁定。',
  },
};

const LANGS = [
  ['plaintext', 'Plain text'], ['markdown', 'Markdown'],
  ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['python', 'Python'], ['go', 'Go'], ['rust', 'Rust'], ['java', 'Java'],
  ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['php', 'PHP'], ['ruby', 'Ruby'],
  ['bash', 'Bash/Shell'], ['sql', 'SQL'], ['html', 'HTML'], ['css', 'CSS'],
  ['json', 'JSON'], ['yaml', 'YAML'], ['xml', 'XML'],
];

export function notePage(meta, lang) {
  const t = I18N[lang] || I18N.en;
  const metaJson = JSON.stringify({
    id: meta.id,
    exists: !!meta.exists,
    hasPassword: !!meta.hasPassword,
    expired: !!meta.expired,
    expiresAt: meta.expiresAt ?? null,
    title: meta.title ?? null,
    filename: meta.filename ?? null,
    lang: meta.lang ?? null,
    readonly: !!meta.readonly,
  });
  const idAttr = escapeHtml(meta.id);
  const titleTag = meta.title ? escapeHtml(meta.title) : `${idAttr} — signote`;
  const langOpts = LANGS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  const fl = (s) => escapeHtml(s);
  const docLang = lang === 'zh' ? 'zh' : 'en';
  return `<!doctype html>
<html lang="${docLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${titleTag}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231a1a1a'/%3E%3Crect x='9' y='7' width='14' height='18' rx='2' stroke='%23fff' stroke-width='1.5' fill='none'/%3E%3Cpath d='M12 12h8M12 16h8M12 20h5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  :root { --bg:#fafafa; --fg:#1a1a1a; --muted:#6b7280; --accent:#2563eb; --card:#fff; --border:#e5e7eb; --code:#f6f8fa; --danger:#dc2626; --ok:#16a34a; }
  * { box-sizing: border-box; }
  html,body { height:100%; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         background: var(--bg); color: var(--fg); display:flex; flex-direction:column; -webkit-font-smoothing:antialiased; }
  header { display:flex; align-items:center; gap:10px; padding: 10px 16px; border-bottom:1px solid var(--border); background:var(--card); flex-wrap:wrap; }
  header .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--fg); font-weight:600; font-size:.9rem; }
  header .title { color:var(--muted); font-size:.85rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  header .spacer { flex:1; }
  header a { color:var(--muted); text-decoration:none; font-size:.85rem; }
  header a:hover { color:var(--fg); }
  .lang-switch { display:flex; gap:0; border:1px solid var(--border); border-radius:5px; overflow:hidden; }
  .lang-switch button { border:none; background:var(--card); color:var(--muted); padding:4px 8px; cursor:pointer; font-size:.75rem; }
  .lang-switch button.active { background:var(--fg); color:#fff; }
  .tabs { display:flex; gap:2px; }
  .tab { padding:5px 10px; border-radius:5px; cursor:pointer; font-size:.85rem; color:var(--muted); }
  .tab.active { background:var(--code); color:var(--fg); }
  .btn { padding:6px 12px; border-radius:5px; border:1px solid var(--border); background:var(--card); color:var(--fg); cursor:pointer; font-size:.85rem; }
  .btn.primary { background:var(--fg); color:#fff; border-color:var(--fg); font-weight:500; }
  main { flex:1; display:flex; flex-direction:column; min-height:0; }
  #editor { flex:1; width:100%; resize:none; border:none; outline:none; padding:20px; background:var(--bg); color:var(--fg);
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; line-height:1.6; }
  #preview { flex:1; padding:24px 20px; overflow:auto; max-width: 820px; margin: 0 auto; width:100%; line-height:1.7; }
  #preview pre { background:var(--code); padding:14px; border-radius:6px; overflow:auto; border:1px solid var(--border); }
  #preview code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  #preview :not(pre)>code { background:var(--code); padding:1px 6px; border-radius:4px; font-size:.9em; }
  #preview blockquote { border-left:3px solid var(--border); margin:0 0 12px; padding-left:14px; color:var(--muted); }
  #preview h1,#preview h2,#preview h3 { line-height:1.3; margin-top:1.4em; }
  #preview table { border-collapse:collapse; }
  #preview th, #preview td { border:1px solid var(--border); padding:6px 12px; }
  .hidden { display:none !important; }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:50; }
  .panel { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:22px; width:min(420px,92vw); box-shadow:0 4px 16px rgba(0,0,0,.04); max-height:90vh; overflow:auto; }
  .panel h3 { margin:0 0 14px; font-size:1rem; }
  .panel label { display:block; margin-bottom:4px; font-size:.8rem; color:var(--muted); }
  .panel input, .panel select { width:100%; padding:9px 11px; border-radius:5px; border:1px solid var(--border);
                                  background:#fff; color:var(--fg); font-size:.9rem; margin-bottom:12px; }
  .panel input:focus, .panel select:focus { outline:none; border-color:var(--fg); }
  .panel .row { display:flex; gap:8px; }
  .muted { color: var(--muted); font-size:.82rem; }
  .status { padding:8px 16px; font-size:.82rem; color:var(--muted); }
  .status.ok { color:var(--ok); }
  .status.err { color:var(--danger); }
  .expired { text-align:center; padding:80px 20px; }
  .expired h2 { color:var(--muted); font-weight:600; margin:0 0 6px; }
  .readonly-notice { background:#fef3c7; border:1px solid #fcd34d; border-radius:6px; padding:10px 16px; margin:0 0 0; font-size:.82rem; color:#92400e; display:flex; align-items:center; gap:8px; }
  .readonly-notice .lock { font-size:1rem; }
  .readonly-badge { background:#f59e0b; color:#fff; padding:2px 8px; border-radius:10px; font-size:.72rem; font-weight:500; }
  .warn-box { background:#fef3c7; border:1px solid #fcd34d; border-radius:6px; padding:10px 12px; margin:8px 0 12px; font-size:.8rem; color:#92400e; line-height:1.5; }
  .panel .msg { margin-top:8px; font-size:.82rem; min-height:1.2em; }
  .panel .msg.ok { color:var(--ok); } .panel .msg.err { color:var(--danger); }
  #editor[readonly] { background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }
  header .badge-group { display:flex; gap:4px; align-items:center; }
</style>
</head>
<body>
<header>
  <span class="id">/${idAttr}</span>
  <span class="title hidden" id="hdr-title"></span>
  <span class="badge-group" id="hdr-badges"></span>
  <div class="tabs">
    <div class="tab active" data-tab="edit" id="tab-edit">${fl(t.edit)}</div>
    <div class="tab" data-tab="preview" id="tab-preview">${fl(t.preview)}</div>
  </div>
  <div class="spacer"></div>
  <div class="lang-switch">
    <button onclick="setLang('en')" class="${lang==='en'?'active':''}">EN</button>
    <button onclick="setLang('zh')" class="${lang==='zh'?'active':''}">中文</button>
  </div>
  <button class="btn" id="btn-settings">${fl(t.settings)}</button>
  <button class="btn primary" id="btn-save">${fl(t.save)}</button>
  <a href="/${idAttr}/raw" target="_blank">${fl(t.raw)}</a>
  <a href="/${idAttr}/img" target="_blank">${fl(t.img)}</a>
  <a href="/${idAttr}/dl" target="_blank">${fl(t.dl)}</a>
</header>
<div class="status" id="status"></div>
<div class="readonly-notice hidden" id="ro-notice"><span class="lock">🔒</span><span id="ro-notice-text"></span></div>
<main>
  <textarea id="editor" placeholder="# ${fl(t.edit)}..."></textarea>
  <div id="preview" class="hidden"></div>
</main>

<!-- password prompt -->
<div class="overlay hidden" id="pw-overlay">
  <div class="panel">
    <h3>${fl(t.pwTitle)}</h3>
    <input type="password" id="pw-input" placeholder="${fl(t.pwPlaceholder)}" autocomplete="off" />
    <div class="row">
      <button class="btn primary" id="pw-submit">${fl(t.pwUnlock)}</button>
    </div>
    <p class="muted" id="pw-err" style="color:var(--danger);"></p>
  </div>
</div>

<!-- expired notice -->
<div class="expired hidden" id="expired-box">
  <h2>${fl(t.expired)}</h2>
  <p class="muted">${fl(t.expiredSub)}</p>
  <button class="btn primary" id="btn-expired-clear" style="margin-top:18px;">${fl(t.expiredClear)}</button>
  <p class="muted" id="expired-msg" style="margin-top:12px;min-height:1em;"></p>
</div>

<!-- settings -->
<div class="overlay hidden" id="settings-overlay">
  <div class="panel">
    <h3>${fl(t.settingsTitle)}</h3>
    <label>${fl(t.title)}</label>
    <input type="text" id="set-title" placeholder="${fl(t.titlePh)}" maxlength="200" autocomplete="off" />
    <label>${fl(t.filename)}</label>
    <input type="text" id="set-filename" placeholder="${fl(t.filenamePh)}" maxlength="200" autocomplete="off" />
    <label>${fl(t.language)}</label>
    <select id="set-lang">
      <option value="">${fl(t.langAuto)}</option>
      ${langOpts}
    </select>
    <label>${fl(t.ttl)}</label>
    <select id="set-ttl">
      <option value="">${fl(t.ttlForever)}</option>
      <option value="1h">1 hour</option>
      <option value="1d">1 day</option>
      <option value="7d">7 days</option>
      <option value="30d">30 days</option>
    </select>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="set-readonly" style="width:auto;margin:0;" />
      ${fl(t.readonly)}
    </label>
    <div class="warn-box hidden" id="ro-warn">${fl(t.readonlyWarn)}</div>
    <label>${fl(t.password)}</label>
    <input type="text" id="set-pw" placeholder="${fl(t.pwPlaceholder)}" autocomplete="off" />
    <div class="row">
      <button class="btn primary" id="set-save">${fl(t.saveSettings)}</button>
      <button class="btn" id="set-close">${fl(t.close)}</button>
    </div>
    <p class="msg" id="set-msg"></p>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script>
const META = ${escapeJs(metaJson)};
const T = ${escapeJs(JSON.stringify(t))};
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
let curPassword = '';

marked.setOptions({ gfm: true });

function setStatus(msg, isErr){ const s=$('#status'); s.textContent=msg; s.className='status '+(isErr?'err':'ok'); }
function setLang(l){ document.cookie='nm_lang='+l+';path=/;max-age=31536000'; location.reload(); }

// ---- tabs ----
function showTab(tab){
  $('#tab-edit').classList.toggle('active', tab==='edit');
  $('#tab-preview').classList.toggle('active', tab==='preview');
  $('#editor').classList.toggle('hidden', tab!=='edit');
  $('#preview').classList.toggle('hidden', tab!=='preview');
  if (tab==='preview') renderPreview();
}
$('#tab-edit').onclick = ()=>showTab('edit');
$('#tab-preview').onclick = ()=>showTab('preview');

function renderPreview(){
  const md = $('#editor').value;
  // When a language is set, render content as a single highlighted code block.
  if (META.lang && META.lang !== 'markdown') {
    const esc = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    $('#preview').innerHTML = '<pre><code class="language-'+META.lang+'">'+esc+'</code></pre>';
    $$('#preview pre code').forEach(b=>{ try{ hljs.highlightElement(b); }catch(e){} });
    return;
  }
  // Markdown mode: protect math from marked, then parse, sanitize, highlight, render math.
  // Extract $$...$$ and $...$ into placeholders so marked doesn't mangle them.
  const mathBlocks = [];
  let src = md;
  const PH = (i) => 'XKXKmath' + i + 'XKXK';
  const reDisplay = new RegExp('\\\\\\$\\\\\\$([\\\\s\\\\S]+?)\\\\\\$\\\\\\$', 'g');
  const reInline = new RegExp('\\\\\\$([^\\\\n$]+?)\\\\\\$', 'g');
  // display math first ($$...$$)
  src = src.replace(reDisplay, (_, body) => {
    mathBlocks.push({ display: true, body });
    return PH(mathBlocks.length - 1);
  });
  // inline math ($...$)
  src = src.replace(reInline, (_, body) => {
    mathBlocks.push({ display: false, body });
    return PH(mathBlocks.length - 1);
  });
  // Ensure ATX headings (#{1-6} ...) are followed by a blank line so that the
  // next line is parsed as a separate paragraph (standard CommonMark behavior
  // requires a blank line, but users often omit it).
  src = src.replace(/^((?:#{1,6})\\s.+?)\\n([^\\n#])/gm, '$1\\n\\n$2');
  const raw = marked.parse(src);
  const clean = DOMPurify.sanitize(raw);
  $('#preview').innerHTML = clean;
  $$('#preview pre code').forEach(b=>{ try{ hljs.highlightElement(b); }catch(e){} });
  // Render KaTeX math into the placeholder spans
  mathBlocks.forEach((m, i) => {
    const walker = document.createTreeWalker($('#preview'), NodeFilter.SHOW_TEXT, null);
    let node;
    const token = PH(i);
    while ((node = walker.nextNode())) {
      if (node.nodeValue.includes(token)) {
        const span = document.createElement(m.display ? 'div' : 'span');
        if (m.display) span.style.textAlign = 'center';
        try { katex.render(m.body, span, { displayMode: m.display, throwOnError: false }); }
        catch(e) { span.textContent = m.body; }
        node.parentNode.replaceChild(span, node);
        break;
      }
    }
  });
}

// ---- load content ----
async function loadContent(pw){
  const url = '/'+encodeURIComponent(META.id)+'/content'+(pw?'?password='+encodeURIComponent(pw):'');
  const r = await fetch(url);
  if (r.status === 403){ $('#pw-err').textContent = T.pwWrong; return false; }
  if (!r.ok){ setStatus(T.saveFail+r.status, true); return false; }
  const data = await r.json();
  $('#editor').value = data.content || '';
  // sync metadata from server
  META.lang = data.lang || null;
  META.title = data.title || null;
  META.filename = data.filename || null;
  META.readonly = !!data.readonly;
  if (META.title){ $('#hdr-title').textContent = META.title; $('#hdr-title').classList.remove('hidden'); }
  updateReadonlyUI();
  renderPreview();
  return true;
}

async function init(){
  if (META.expired){ $('#expired-box').classList.remove('hidden'); $('main').classList.add('hidden'); return; }
  if (META.title){ $('#hdr-title').textContent = META.title; $('#hdr-title').classList.remove('hidden'); }
  if (META.readonly) updateReadonlyUI();
  if (!META.exists){ setStatus(T.newNote); return; }
  if (META.hasPassword){
    $('#pw-overlay').classList.remove('hidden');
    $('#pw-input').focus();
  } else {
    await loadContent('');
  }
}

$('#pw-submit').onclick = async ()=>{
  const pw = $('#pw-input').value;
  $('#pw-err').textContent = '';
  curPassword = pw;
  const ok = await loadContent(pw);
  if (ok){ $('#pw-overlay').classList.add('hidden'); $('#editor').focus(); }
};
$('#pw-input').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#pw-submit').click(); });

// ---- expired: clear & create new ----
$('#btn-expired-clear').onclick = async ()=>{
  const btn = $('#btn-expired-clear');
  const msgEl = $('#expired-msg');
  btn.disabled = true;
  btn.textContent = T.expiredClearing;
  // Overwrite the expired note with empty content + clear all settings
  const r = await fetch('/'+encodeURIComponent(META.id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '',
      password: '',
      ttl: '',
      title: '',
      filename: '',
      lang: '',
      readonly: false,
    }),
  });
  if (!r.ok){
    let errMsg = r.statusText;
    try { const j = await r.json(); errMsg = j.error || errMsg; } catch(e) {}
    btn.disabled = false;
    btn.textContent = T.expiredClear;
    msgEl.textContent = T.expiredClearFail + errMsg;
    msgEl.style.color = 'var(--danger)';
    return;
  }
  msgEl.textContent = T.expiredCleared;
  msgEl.style.color = 'var(--ok)';
  setTimeout(()=>{ location.reload(); }, 1000);
};

// ---- save ----
async function saveNote(fields){
  if (META.hasPassword && curPassword) fields.current_password = curPassword;
  const r = await fetch('/'+encodeURIComponent(META.id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!r.ok){
    let errMsg = r.statusText;
    try { const j = await r.json(); errMsg = j.error || errMsg; } catch(e) { try { errMsg = await r.text(); } catch(e2){} }
    setStatus(T.saveFail+errMsg, true);
    return false;
  }
  META.exists = true;
  return true;
}

$('#btn-save').onclick = async ()=>{
  const ok = await saveNote({ content: $('#editor').value });
  if (ok) setStatus(T.saved);
};

// ---- settings ----
function updateReadonlyUI(){
  // header badge + lock notice
  const badges = $('#hdr-badges');
  badges.innerHTML = '';
  if (META.readonly){
    badges.innerHTML = '<span class="readonly-badge">'+T.readonlyBadge+'</span>';
    $('#ro-notice-text').textContent = T.readonlyLocked;
    $('#ro-notice').classList.remove('hidden');
    $('#editor').setAttribute('readonly','readonly');
    $('#btn-save').disabled = true;
    $('#btn-save').style.opacity = '.4';
    $('#btn-save').style.cursor = 'not-allowed';
  } else {
    $('#ro-notice').classList.add('hidden');
    $('#editor').removeAttribute('readonly');
    $('#btn-save').disabled = false;
    $('#btn-save').style.opacity = '';
    $('#btn-save').style.cursor = '';
  }
}

$('#btn-settings').onclick = ()=> {
  // pre-fill current values
  if (META.title) $('#set-title').value = META.title;
  if (META.filename) $('#set-filename').value = META.filename;
  if (META.lang) $('#set-lang').value = META.lang;
  $('#set-readonly').checked = !!META.readonly;
  // if already readonly, disable the checkbox (can't un-set from here)
  if (META.readonly){
    $('#set-readonly').disabled = true;
    $('#set-readonly').parentElement.style.opacity = '.5';
    $('#set-readonly').parentElement.style.cursor = 'not-allowed';
    $('#ro-warn').classList.add('hidden');
  } else {
    $('#set-readonly').disabled = false;
    $('#set-readonly').parentElement.style.opacity = '';
    $('#set-readonly').parentElement.style.cursor = 'pointer';
    $('#ro-warn').classList.toggle('hidden', !$('#set-readonly').checked);
  }
  $('#set-msg').textContent=''; $('#set-msg').className='msg';
  $('#settings-overlay').classList.remove('hidden');
};
$('#set-readonly').onchange = ()=> {
  $('#ro-warn').classList.toggle('hidden', !$('#set-readonly').checked);
  if ($('#set-readonly').checked && !$('#set-ttl').value){
    // highlight TTL select
    $('#set-ttl').style.borderColor = 'var(--danger)';
  } else {
    $('#set-ttl').style.borderColor = '';
  }
};
$('#set-ttl').onchange = ()=> { $('#set-ttl').style.borderColor = ''; };
$('#set-close').onclick = ()=> $('#settings-overlay').classList.add('hidden');
$('#set-save').onclick = async ()=>{
  const ttl = $('#set-ttl').value;
  const pw = $('#set-pw').value;
  const title = $('#set-title').value;
  const filename = $('#set-filename').value;
  const lang = $('#set-lang').value;
  const readonly = $('#set-readonly').checked;
  // frontend validation: readonly requires TTL
  if (readonly && !ttl){
    $('#set-msg').className='msg err';
    $('#set-msg').textContent = T.readonlyNeedsTtl;
    $('#set-ttl').style.borderColor = 'var(--danger)';
    $('#set-ttl').focus();
    return;
  }
  const fields = { password: pw, ttl: ttl || undefined, title, filename, lang, readonly };
  // clear any previous error
  $('#set-msg').textContent=''; $('#set-msg').className='msg';
  const ok = await saveNote(fields);
  if (ok){
    META.title = title || null;
    META.filename = filename || null;
    META.lang = lang || null;
    META.readonly = readonly;
    if (META.title){ $('#hdr-title').textContent = META.title; $('#hdr-title').classList.remove('hidden'); }
    else { $('#hdr-title').classList.add('hidden'); }
    updateReadonlyUI();
    $('#set-msg').className='msg ok';
    $('#set-msg').textContent = T.settingsSaved;
    if (pw){ META.hasPassword = true; curPassword = pw; }
    setTimeout(()=>{ $('#set-msg').textContent=''; }, 1500);
  } else {
    // saveNote already set status bar; also show in panel
    const st = $('#status');
    $('#set-msg').className='msg err';
    $('#set-msg').textContent = st.textContent;
  }
};

// Ctrl/Cmd+S to save
window.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey) && e.key==='s'){ e.preventDefault(); $('#btn-save').click(); }
});

init();
</script>
</body>
</html>`;
}
