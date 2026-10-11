// src/pages/admin.js
// Admin panel served at GET /admin
// Supports i18n (en/zh) via nm_lang cookie, full note property management.

import { escapeHtml } from '../utils.js';

const I18N = {
  en: {
    login: 'Admin login', signIn: 'Sign in', back: 'back', invalidPw: 'Invalid password.',
    adminTitle: 'signote admin',
    tabs: { notes: 'Notes', settings: 'Settings', ips: 'IP bans' },
    site: 'site', logout: 'logout',
    refresh: 'Refresh', deleteSelected: 'Delete selected', noteCount: ' note(s)',
    colId: 'ID', colSize: 'Size', colStatus: 'Status', colViews: 'Views', colIp: 'IP', colUpdated: 'Updated',
    colReadonly: 'RO', colExpiry: 'Expiry',
    pw: 'pw', ro: 'ro',
    edit: 'Edit', view: 'View content', cancel: 'Cancel', save: 'Save',
    content: 'Content', password: 'Password', readonly: 'Read-only', ttl: 'TTL (seconds)',
    title: 'Title', filename: 'Filename', lang: 'Language',
    pwRemove: '(empty = remove)', ttlRemove: '(empty = remove)',
    saved: 'Saved.', saveFail: 'Save failed: ',
    deleteConfirm: 'Delete note(s)? This cannot be undone.',
    globalSettings: 'Global settings', maxChars: 'Max characters per note',
    randomIdLen: 'Random ID length (2-32)', contactEmail: 'Contact email (footer)',
    banIp: 'Ban an IP', ipPlaceholder: '1.2.3.4', reasonPlaceholder: 'reason (optional)',
    permanent: 'Permanent', ban: 'Ban', bannedIps: 'Banned IPs', unban: 'Unban',
    noBans: 'No banned IPs.', ipRequired: 'ip required',
  },
  zh: {
    login: '管理员登录', signIn: '登录', back: '返回', invalidPw: '密码错误。',
    adminTitle: 'signote 管理',
    tabs: { notes: '笔记', settings: '设置', ips: 'IP 封禁' },
    site: '首页', logout: '退出',
    refresh: '刷新', deleteSelected: '删除选中', noteCount: ' 条笔记',
    colId: 'ID', colSize: '大小', colStatus: '状态', colViews: '浏览', colIp: 'IP', colUpdated: '更新时间',
    colReadonly: '只读', colExpiry: '过期时间',
    pw: '密码', ro: '只读',
    edit: '编辑', view: '查看内容', cancel: '取消', save: '保存',
    content: '内容', password: '密码', readonly: '只读', ttl: '过期时间（秒）',
    title: '标题', filename: '文件名', lang: '语言',
    pwRemove: '（留空 = 移除）', ttlRemove: '（留空 = 移除）',
    saved: '已保存。', saveFail: '保存失败：',
    deleteConfirm: '确认删除笔记？此操作不可撤销。',
    globalSettings: '全局设置', maxChars: '每条笔记最大字符数',
    randomIdLen: '随机 ID 长度（2-32）', contactEmail: '联系邮箱（页脚）',
    banIp: '封禁 IP', ipPlaceholder: '1.2.3.4', reasonPlaceholder: '原因（可选）',
    permanent: '永久', ban: '封禁', bannedIps: '已封禁 IP', unban: '解封',
    noBans: '无封禁 IP。', ipRequired: '需要 IP',
  },
};

export function adminPage(authed, settings, lang) {
  if (!authed) return loginPage(lang);
  return panelPage(settings, lang);
}

function loginPage(lang) {
  const t = I18N[lang] || I18N.en;
  const fl = (s) => escapeHtml(s);
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh' : 'en'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${fl(t.login)} — signote</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231a1a1a'/%3E%3Crect x='9' y='7' width='14' height='18' rx='2' stroke='%23fff' stroke-width='1.5' fill='none'/%3E%3Cpath d='M12 12h8M12 16h8M12 20h5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
  body{margin:0;background:#fafafa;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;-webkit-font-smoothing:antialiased;}
  .box{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:28px;width:min(360px,92vw);box-shadow:0 4px 16px rgba(0,0,0,.04);}
  h1{font-size:1.1rem;margin:0 0 18px;font-weight:600;}
  input{width:100%;padding:10px 12px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;color:#1a1a1a;font-size:.95rem;margin-bottom:12px;box-sizing:border-box;}
  input:focus{outline:none;border-color:#1a1a1a;}
  button{width:100%;padding:10px;border-radius:6px;border:1px solid #1a1a1a;background:#1a1a1a;color:#fff;font-weight:500;cursor:pointer;font-size:.95rem;}
  .err{color:#dc2626;font-size:.85rem;min-height:1.2em;margin-top:4px;}
  .back{text-align:center;}
  .back a{color:#6b7280;text-decoration:none;font-size:.85rem;}
  .lang-switch{display:flex;gap:0;border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;margin-bottom:16px;justify-content:center;}
  .lang-switch button{width:auto;border:none;background:#fff;color:#6b7280;padding:4px 10px;cursor:pointer;font-size:.75rem;}
  .lang-switch button.active{background:#1a1a1a;color:#fff;}
</style></head>
<body>
<div class="box">
  <div class="lang-switch">
    <button onclick="setLang('en')" class="${lang==='en'?'active':''}">EN</button>
    <button onclick="setLang('zh')" class="${lang==='zh'?'active':''}">中文</button>
  </div>
  <h1>${fl(t.login)}</h1>
  <form id="f">
    <input type="password" id="pw" placeholder="${fl(t.login)}" autocomplete="off" autofocus/>
    <button type="submit">${fl(t.signIn)}</button>
  </form>
  <p class="err" id="err"></p>
  <p class="back"><a href="/" style="color:#8b949e;">← ${fl(t.back)}</a></p>
</div>
<script>
function setLang(l){document.cookie='nm_lang='+l+';path=/;max-age=31536000';location.reload();}
document.getElementById('f').addEventListener('submit', async e=>{
  e.preventDefault();
  const r = await fetch('/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: document.getElementById('pw').value})});
  if (r.ok){ location.reload(); }
  else { document.getElementById('err').textContent = '${fl(t.invalidPw)}'; }
});
</script>
</body></html>`;
}

function panelPage(settings, lang) {
  const t = I18N[lang] || I18N.en;
  const fl = (s) => escapeHtml(s);
  const T = JSON.stringify(t).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh' : 'en'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${fl(t.adminTitle)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231a1a1a'/%3E%3Crect x='9' y='7' width='14' height='18' rx='2' stroke='%23fff' stroke-width='1.5' fill='none'/%3E%3Cpath d='M12 12h8M12 16h8M12 20h5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
  :root{--bg:#fafafa;--fg:#1a1a1a;--muted:#6b7280;--accent:#2563eb;--card:#fff;--border:#e5e7eb;--code:#f6f8fa;--danger:#dc2626;--ok:#16a34a;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
  header{padding:12px 20px;border-bottom:1px solid var(--border);background:var(--card);display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  header h1{font-size:1rem;margin:0;font-weight:600;}
  header .spacer{flex:1;}
  header a{color:var(--muted);text-decoration:none;font-size:.85rem;}
  header a:hover{color:var(--fg);}
  .lang-switch{display:flex;gap:0;border:1px solid var(--border);border-radius:5px;overflow:hidden;}
  .lang-switch button{border:none;background:var(--card);color:var(--muted);padding:4px 8px;cursor:pointer;font-size:.75rem;}
  .lang-switch button.active{background:var(--fg);color:#fff;}
  .tabs{display:flex;gap:2px;}
  .tab{padding:6px 12px;border-radius:5px;cursor:pointer;color:var(--muted);font-size:.85rem;}
  .tab.active{background:var(--code);color:var(--fg);}
  main{max-width:1100px;margin:28px auto;padding:0 20px;}
  .view{display:none;}
  .view.active{display:block;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:14px;}
  .card h3{margin:0 0 14px;font-size:.95rem;font-weight:600;}
  table{width:100%;border-collapse:collapse;font-size:.85rem;}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);}
  th{color:var(--muted);font-weight:500;font-size:.8rem;}
  tr:hover td{background:var(--code);}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
  input,select,textarea{padding:8px 10px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--fg);font-size:.85rem;}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--fg);}
  textarea{width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;}
  button{padding:7px 12px;border-radius:5px;border:1px solid var(--border);background:var(--card);color:var(--fg);cursor:pointer;font-size:.85rem;}
  button.primary{background:var(--fg);color:#fff;border-color:var(--fg);font-weight:500;}
  button.danger{background:var(--danger);color:#fff;border-color:transparent;}
  button:disabled{opacity:.5;cursor:not-allowed;}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .muted{color:var(--muted);font-size:.8rem;}
  .toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;}
  .badge{padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:500;}
  .badge.active{background:#dcfce7;color:var(--ok);}
  .badge.expired{background:#fee2e2;color:var(--danger);}
  .form-row{margin-bottom:12px;}
  .form-row label{display:block;margin-bottom:4px;font-size:.8rem;color:var(--muted);}
  .msg{margin-top:8px;font-size:.82rem;}
  .msg.ok{color:var(--ok);} .msg.err{color:var(--danger);}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:50;}
  .panel{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:22px;width:min(620px,94vw);box-shadow:0 4px 16px rgba(0,0,0,.08);max-height:90vh;overflow:auto;}
  .panel h3{margin:0 0 14px;font-size:1rem;}
  .panel label{display:block;margin-bottom:4px;font-size:.8rem;color:var(--muted);}
  .panel input,.panel select,.panel textarea{width:100%;padding:9px 11px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--fg);font-size:.9rem;margin-bottom:12px;}
  .panel .row{display:flex;gap:8px;}
  .hidden{display:none !important;}
</style></head>
<body>
<header>
  <h1>${fl(t.adminTitle)}</h1>
  <div class="tabs">
    <div class="tab active" data-v="notes">${fl(t.tabs.notes)}</div>
    <div class="tab" data-v="settings">${fl(t.tabs.settings)}</div>
    <div class="tab" data-v="ips">${fl(t.tabs.ips)}</div>
  </div>
  <div class="spacer"></div>
  <div class="lang-switch">
    <button onclick="setLang('en')" class="${lang==='en'?'active':''}">EN</button>
    <button onclick="setLang('zh')" class="${lang==='zh'?'active':''}">中文</button>
  </div>
  <a href="/">← ${fl(t.site)}</a>
  <a href="#" id="logout">${fl(t.logout)}</a>
</header>
<main>

<!-- NOTES -->
<section class="view active" id="v-notes">
  <div class="card">
    <div class="toolbar">
      <button class="btn" id="notes-refresh">${fl(t.refresh)}</button>
      <button class="danger" id="notes-delete" disabled>${fl(t.deleteSelected)}</button>
      <span class="muted" id="notes-count"></span>
    </div>
    <table>
      <thead><tr>
        <th><input type="checkbox" id="sel-all"/></th>
        <th>${fl(t.colId)}</th><th>${fl(t.colSize)}</th><th>${fl(t.colStatus)}</th><th>${fl(t.colReadonly)}</th><th>${fl(t.colExpiry)}</th><th>${fl(t.colViews)}</th><th>${fl(t.colIp)}</th><th>${fl(t.colUpdated)}</th>
      </tr></thead>
      <tbody id="notes-body"></tbody>
    </table>
  </div>
</section>

<!-- SETTINGS -->
<section class="view" id="v-settings">
  <div class="card">
    <h3 style="margin-top:0">${fl(t.globalSettings)}</h3>
    <div class="form-row">
      <label>${fl(t.maxChars)}</label>
      <input type="number" id="max-chars" value="${escapeHtml(String(settings.maxChars))}" min="1"/>
    </div>
    <div class="form-row">
      <label>${fl(t.randomIdLen)}</label>
      <input type="number" id="random-id-len" value="${escapeHtml(String(settings.randomIdLen))}" min="2" max="32"/>
    </div>
    <div class="form-row">
      <label>${fl(t.contactEmail)}</label>
      <input type="email" id="contact-email" value="${escapeHtml(settings.contactEmail)}" placeholder="admin@example.com"/>
    </div>
    <div class="row">
      <button class="primary" id="save-settings">${fl(t.save)}</button>
      <span class="msg" id="settings-msg"></span>
    </div>
  </div>
</section>

<!-- IP BANS -->
<section class="view" id="v-ips">
  <div class="card">
    <h3 style="margin-top:0">${fl(t.banIp)}</h3>
    <div class="row">
      <input type="text" id="ban-ip" placeholder="${fl(t.ipPlaceholder)}" style="flex:1;min-width:160px;"/>
      <input type="text" id="ban-reason" placeholder="${fl(t.reasonPlaceholder)}" style="flex:1;min-width:160px;"/>
      <select id="ban-ttl">
        <option value="">${fl(t.permanent)}</option>
        <option value="1h">1 hour</option>
        <option value="1d">1 day</option>
        <option value="7d">7 days</option>
        <option value="30d">30 days</option>
      </select>
      <button class="danger" id="ban-add">${fl(t.ban)}</button>
    </div>
    <p class="msg" id="ban-msg"></p>
  </div>
  <div class="card">
    <h3 style="margin-top:0">${fl(t.bannedIps)}</h3>
    <table>
      <thead><tr><th>IP</th><th>Reason</th><th>Created</th><th>Expires</th><th></th></tr></thead>
      <tbody id="ips-body"></tbody>
    </table>
  </div>
</section>

</main>

<!-- note edit overlay -->
<div class="overlay hidden" id="edit-overlay">
  <div class="panel">
    <h3 id="edit-title"></h3>
    <label>${fl(t.content)}</label>
    <textarea id="edit-content" rows="8"></textarea>
    <label>${fl(t.password)} <span class="muted">${fl(t.pwRemove)}</span></label>
    <input type="text" id="edit-password" autocomplete="off"/>
    <label>${fl(t.ttl)} <span class="muted">${fl(t.ttlRemove)}</span></label>
    <input type="text" id="edit-ttl" placeholder="e.g. 7d or 604800"/>
    <label>${fl(t.title)}</label>
    <input type="text" id="edit-note-title" maxlength="200"/>
    <label>${fl(t.filename)}</label>
    <input type="text" id="edit-filename" maxlength="200"/>
    <label>${fl(t.lang)}</label>
    <select id="edit-lang">
      <option value="">${fl(t.lang)}</option>
      <option value="plaintext">Plain text</option>
      <option value="markdown">Markdown</option>
      <option value="javascript">JavaScript</option>
      <option value="typescript">TypeScript</option>
      <option value="python">Python</option>
      <option value="go">Go</option>
      <option value="rust">Rust</option>
      <option value="java">Java</option>
      <option value="c">C</option>
      <option value="cpp">C++</option>
      <option value="csharp">C#</option>
      <option value="php">PHP</option>
      <option value="ruby">Ruby</option>
      <option value="bash">Bash/Shell</option>
      <option value="sql">SQL</option>
      <option value="html">HTML</option>
      <option value="css">CSS</option>
      <option value="json">JSON</option>
      <option value="yaml">YAML</option>
      <option value="xml">XML</option>
    </select>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:12px;">
      <input type="checkbox" id="edit-readonly" style="width:auto;margin:0;"/>
      ${fl(t.readonly)}
    </label>
    <div class="row">
      <button class="primary" id="edit-save">${fl(t.save)}</button>
      <button id="edit-cancel">${fl(t.cancel)}</button>
      <span class="msg" id="edit-msg"></span>
    </div>
  </div>
</div>

<script>
const T = ${T};
const $ = s => document.querySelector(s);
function setLang(l){document.cookie='nm_lang='+l+';path=/;max-age=31536000';location.reload();}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(s){ if(!s) return '—'; const d=new Date(s*1000); return d.toISOString().replace('T',' ').slice(0,16)+' UTC'; }
function fmtSize(n){ if(n<1024) return n+' B'; if(n<1024*1024) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
function msg(el, text, isErr){ el.textContent=text; el.className='msg '+(isErr?'err':'ok'); }

// tabs
document.querySelectorAll('.tab').forEach(t=> t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  $('#v-'+t.dataset.v).classList.add('active');
});

$('#logout').onclick = async e=>{ e.preventDefault(); await fetch('/admin/logout',{method:'POST'}); location.href='/'; };

// ---- notes ----
let curEditId = null;
async function loadNotes(){
  const r = await fetch('/admin/api/notes');
  if (!r.ok){ msg($('#notes-count'), 'load failed: '+r.status, true); return; }
  const data = await r.json();
  const rows = data.notes || [];
  $('#notes-count').textContent = rows.length + T.noteCount;
  $('#notes-body').innerHTML = rows.map(function(n){
    return '<tr>' +
      '<td><input type="checkbox" class="note-cb" value="'+esc(n.id)+'"/></td>' +
      '<td><a class="mono" href="/'+encodeURIComponent(n.id)+'" target="_blank">'+esc(n.id)+'</a> <button class="edit-btn" data-id="'+esc(n.id)+'" style="font-size:.72rem;padding:2px 6px;">'+T.edit+'</button></td>' +
      '<td>'+fmtSize(n.size)+'</td>' +
      '<td><span class="badge '+esc(n.status)+'">'+esc(n.status)+'</span>'+(n.has_password?' <span class="muted">'+T.pw+'</span>':'')+'</td>' +
      '<td>'+(n.readonly?'<span class="badge" style="background:#fef3c7;color:#92400e;">'+T.ro+'</span>':'—')+'</td>' +
      '<td>'+(n.expires_at?fmtTime(n.expires_at):'—')+'</td>' +
      '<td>'+n.views+'</td>' +
      '<td class="mono muted">'+esc(n.ip||'—')+'</td>' +
      '<td>'+fmtTime(n.updated_at)+'</td>' +
      '</tr>';
  }).join('');
  document.querySelectorAll('.edit-btn').forEach(b=> b.onclick=()=> openEdit(b.dataset.id));
  syncSel();
}
function selectedIds(){ return [...document.querySelectorAll('.note-cb:checked')].map(c=>c.value); }
function syncSel(){ $('#notes-delete').disabled = selectedIds().length===0; }
$('#notes-body').addEventListener('change', syncSel);
$('#sel-all').onchange = e=>{ document.querySelectorAll('.note-cb').forEach(c=>c.checked=e.target.checked); syncSel(); };
$('#notes-refresh').onclick = loadNotes;
$('#notes-delete').onclick = async ()=>{
  const ids = selectedIds();
  if (!ids.length) return;
  if (!confirm(T.deleteConfirm)) return;
  const r = await fetch('/admin/api/notes/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ids})});
  if (!r.ok){ alert('Delete failed: '+r.status); return; }
  loadNotes();
};

// ---- edit overlay ----
async function openEdit(id){
  curEditId = id;
  $('#edit-title').textContent = id;
  const r = await fetch('/admin/api/notes/'+encodeURIComponent(id));
  if (!r.ok){ msg($('#edit-msg'), 'load failed: '+r.status, true); return; }
  const data = await r.json();
  const n = data.note;
  $('#edit-content').value = n.content || '';
  $('#edit-password').value = '';
  $('#edit-ttl').value = n.expires_at ? String(n.expires_at) : '';
  $('#edit-note-title').value = n.title || '';
  $('#edit-filename').value = n.filename || '';
  $('#edit-lang').value = n.lang || '';
  $('#edit-readonly').checked = !!n.readonly;
  $('#edit-msg').textContent = '';
  $('#edit-overlay').classList.remove('hidden');
}
$('#edit-cancel').onclick = ()=> $('#edit-overlay').classList.add('hidden');
$('#edit-save').onclick = async ()=>{
  const body = { content: $('#edit-content').value };
  const pw = $('#edit-password').value;
  if (pw !== '') body.password = pw;
  const ttl = $('#edit-ttl').value.trim();
  if (ttl) body.ttl = ttl;
  else body.ttl = '';
  body.title = $('#edit-note-title').value;
  body.filename = $('#edit-filename').value;
  body.lang = $('#edit-lang').value;
  body.readonly = $('#edit-readonly').checked;
  const r = await fetch('/admin/api/notes/'+encodeURIComponent(curEditId)+'/update', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  if (!r.ok){ msg($('#edit-msg'), T.saveFail + (await r.text().catch(()=>r.status)), true); return; }
  msg($('#edit-msg'), T.saved, false);
  setTimeout(()=>{ $('#edit-overlay').classList.add('hidden'); loadNotes(); }, 800);
};

// ---- settings ----
$('#save-settings').onclick = async ()=>{
  const mc = parseInt($('#max-chars').value, 10);
  if (!mc || mc<1){ msg($('#settings-msg'), T.maxChars+' must be > 0', true); return; }
  const rl = parseInt($('#random-id-len').value, 10);
  if (!rl || rl<2 || rl>32){ msg($('#settings-msg'), T.randomIdLen+' 2-32', true); return; }
  const ce = $('#contact-email').value.trim();
  const r = await fetch('/admin/api/settings', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({max_chars: mc, random_id_len: rl, contact_email: ce})});
  if (!r.ok){ const j=await r.json().catch(()=>{}); msg($('#settings-msg'), (j&&j.error)||'save failed: '+r.status, true); return; }
  msg($('#settings-msg'), T.saved);
};

// ---- ips ----
async function loadIps(){
  const r = await fetch('/admin/api/ips');
  const data = r.ok ? await r.json() : {bans:[]};
  const bans = data.bans || [];
  $('#ips-body').innerHTML = bans.length ? bans.map(function(b){
    return '<tr>' +
      '<td class="mono">'+esc(b.ip)+'</td>' +
      '<td>'+esc(b.reason||'—')+'</td>' +
      '<td>'+fmtTime(b.created_at)+'</td>' +
      '<td>'+(b.expires_at?fmtTime(b.expires_at):T.permanent)+'</td>' +
      '<td><button data-ip="'+esc(b.ip)+'" class="unban">'+T.unban+'</button></td>' +
      '</tr>';
  }).join('') : '<tr><td colspan="5" class="muted">'+T.noBans+'</td></tr>';
  document.querySelectorAll('.unban').forEach(b=> b.onclick= async ()=>{
    await fetch('/admin/api/ips/unban', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ip: b.dataset.ip})});
    loadIps();
  });
}
$('#ban-add').onclick = async ()=>{
  const ip = $('#ban-ip').value.trim();
  if (!ip){ msg($('#ban-msg'), T.ipRequired, true); return; }
  const r = await fetch('/admin/api/ips/ban', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ip, reason: $('#ban-reason').value, ttl: $('#ban-ttl').value})});
  if (!r.ok){ msg($('#ban-msg'),'ban failed: '+r.status, true); return; }
  $('#ban-ip').value=''; $('#ban-reason').value='';
  loadIps();
  msg($('#ban-msg'), T.saved);
};

loadNotes();
loadIps();
</script>
</body></html>`;
}
