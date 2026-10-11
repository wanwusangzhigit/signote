// src/pages/home.js
// Intro/landing page served at GET /
// curl examples use the real request host (passed in from the route handler).

const I18N = {
  en: {
    title: 'signote',
    subtitle: 'A lightweight markdown pastebin on Cloudflare Workers + D1.',
    open: 'Open',
    idPlaceholder: 'note id (blank = random)',
    hint: 'Pick an id to open or create, e.g. /my-idea.',
    features: 'Features',
    featuresList: [
      'Markdown + KaTeX math + syntax-highlighted code blocks.',
      'Optional per-note password, read-only, and retention (TTL, max 30 days).',
      'Expired notes become inaccessible; content is kept, not deleted.',
      '/raw, /img (SVG), /put (curl upload), /dl (file download).',
    ],
    curl: 'curl upload',
    language: 'Language',
  },
  zh: {
    title: 'signote',
    subtitle: '运行于 Cloudflare Workers + D1 的轻量 Markdown 粘贴板。',
    open: '打开',
    idPlaceholder: '笔记 id（留空 = 随机）',
    hint: '输入 id 打开或创建笔记，例如 /my-idea。',
    features: '功能',
    featuresList: [
      'Markdown + KaTeX 数学公式 + 代码高亮。',
      '可选密码、只读、保留时间（最长 30 天）。',
      '过期笔记变为不可访问；内容保留，不删除。',
      '/raw 原文、/img 图片(SVG)、/put curl 上传、/dl 文件下载。',
    ],
    curl: 'curl 上传',
    language: '语言',
  },
};

export function homePage(origin, lang, randomIdLen, contactEmail) {
  const t = I18N[lang] || I18N.en;
  const base = origin || 'https://your-worker.workers.dev';
  const escBase = base.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fl = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${fl(t.title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231a1a1a'/%3E%3Crect x='9' y='7' width='14' height='18' rx='2' stroke='%23fff' stroke-width='1.5' fill='none'/%3E%3Cpath d='M12 12h8M12 16h8M12 20h5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
  :root { --bg:#fafafa; --fg:#1a1a1a; --muted:#6b7280; --accent:#2563eb; --card:#fff; --border:#e5e7eb; --code:#f3f4f6; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         background: var(--bg); color: var(--fg); line-height:1.6; -webkit-font-smoothing:antialiased; }
  .wrap { max-width: 680px; margin: 80px auto; padding: 0 20px; }
  .top { display:flex; justify-content:flex-end; margin-bottom: 20px; }
  .lang-switch { display:flex; gap:0; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
  .lang-switch button { border:none; background:var(--card); color:var(--muted); padding:5px 12px; cursor:pointer; font-size:.82rem; }
  .lang-switch button.active { background:var(--fg); color:#fff; }
  h1 { font-size: 2rem; margin: 0 0 6px; letter-spacing: -0.02em; font-weight: 700; }
  .sub { color: var(--muted); font-size: 1rem; margin: 0 0 28px; }
  .card { background: var(--card); border:1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 14px; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  input[type=text] { flex:1; min-width: 200px; padding: 10px 12px; border-radius: 6px; border:1px solid var(--border);
                     background:#fff; color: var(--fg); font-size: .95rem; }
  input[type=text]:focus { outline:none; border-color: var(--fg); }
  button { padding: 10px 16px; border-radius: 6px; border:1px solid var(--fg); background: var(--fg);
           color:#fff; font-weight:500; cursor:pointer; font-size:.95rem; }
  ul { padding-left: 18px; margin: 6px 0 0; }
  li { margin-bottom: 4px; }
  code { background: var(--code); padding: 1px 6px; border-radius: 4px; font-size: .88em;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .hint { color: var(--muted); font-size: .85rem; margin: 10px 0 0; }
  pre { background: var(--code); padding: 12px; border-radius: 6px; overflow:auto; margin: 8px 0 0;
        font-size: .85rem; line-height:1.5; }
  pre code { background: none; padding: 0; }
  .label { font-size: .8rem; font-weight:600; color: var(--muted); text-transform: uppercase; letter-spacing:.04em; margin: 0 0 8px; }
  footer { color: var(--muted); font-size: .8rem; margin-top: 36px; text-align:center; }
  footer a { color: var(--muted); }
  footer a:hover { color: var(--fg); }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="lang-switch">
      <button onclick="setLang('en')" class="${lang==='en'?'active':''}">EN</button>
      <button onclick="setLang('zh')" class="${lang==='zh'?'active':''}">中文</button>
    </div>
  </div>
  <h1>${fl(t.title)}</h1>
  <p class="sub">${fl(t.subtitle)}</p>

  <div class="card">
    <div class="row">
      <input id="id" type="text" placeholder="${fl(t.idPlaceholder)}" autocomplete="off" />
      <button onclick="go()">${fl(t.open)}</button>
    </div>
    <p class="hint">${fl(t.hint)}</p>
  </div>

  <div class="card">
    <div class="label">${fl(t.features)}</div>
    <ul>
      ${t.featuresList.map(s => `<li>${fl(s)}</li>`).join('')}
    </ul>
  </div>

  <div class="card">
    <div class="label">${fl(t.curl)}</div>
<pre><code>echo "hello world" | curl -T - ${escBase}/my-note/put
echo "secret" | curl -T - "${escBase}/my-note/put?password=hunter2&ttl=1d"</code></pre>
  </div>

  <footer>
    Wanwu &middot; signote${contactEmail ? ` &middot; <a href="mailto:${fl(contactEmail)}">${fl(contactEmail)}</a>` : ''}
  </footer>
</div>
<script>
function rnd(n){const a="abcdefghijklmnopqrstuvwxyz0123456789";let s="";for(let i=0;i<n;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
function go(){let v=document.getElementById('id').value.trim();if(!v)v=rnd(${randomIdLen});location.href='/'+encodeURIComponent(v);}
document.getElementById('id').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
function setLang(l){document.cookie='nm_lang='+l+';path=/;max-age=31536000';location.reload();}
</script>
</body>
</html>`;
}
