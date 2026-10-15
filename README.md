<div align="center">

# signote

**A lightweight, self-hostable Markdown pastebin — running entirely on Cloudflare Workers + D1.**

[![License: MIT](https://img.shields.io/badge/License-MIT-3b82f6.svg?style=flat-square)](./LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](./CONTRIBUTING.md)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-f7df1e?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)

[Features](#-features) · [Quick Start](#-quick-start) · [API](#-api-reference) · [Contributing](#-contributing) · [中文说明](#-中文说明)

</div>

---

## ✨ Features

| | |
|---|---|
| 📝 **Markdown everywhere** | Full Markdown rendering with headings, lists, quotes, tables, links, and inline formatting. |
| 🎨 **Syntax highlighting** | A dependency-free server-side highlighter covering **15+ languages** (JS, TS, Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, Bash, SQL, CSS, JSON, YAML). |
| ∑ **KaTeX math** | Block (`$$ … $$`) and inline (`$ … $`) math, rendered consistently in both the web preview and the exported image. |
| 🖼️ **SVG image export** | Every note can be exported as a self-contained SVG image via `/img` — ideal for embedding in READMEs, chats, and docs. Transparent by default, or pass a custom `bg` color. |
| 🔗 **Share it your way** | Human-readable case-insensitive IDs. Create via the web editor or straight from your terminal with `curl`. |
| 🔒 **Privacy controls** | Per-note **password**, **read-only** mode, and **TTL** (auto-expiry, max 30 days). Expired notes become inaccessible but are never destroyed. |
| 🛡️ **Abuse protection** | IP ban list, per-request audit logging, device fingerprinting, and a hard content-size cap. |
| ⚙️ **Admin panel** | Built-in dashboard to manage notes, tune settings, review logs, and ban/unban IPs — enabled with a single secret. |
| 🌍 **Bilingual UI** | English & 中文 out of the box. |
| 🪶 **Zero runtime dependencies** | Pure JavaScript on the Workers runtime. The only dev dependency is `wrangler`. |

> **Live demo:** <https://n.wanwusangzhi.top>

---

## 🧱 Tech Stack

- **[Cloudflare Workers](https://workers.cloudflare.com/)** — serverless edge runtime (the entire app is one Worker).
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** — serverless SQLite for storage, with versioned SQL migrations.
- **Vanilla JavaScript (ES modules)** — no framework, no bundler, no build step.

---

## 🚀 Quick Start

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Node.js 18+ and npm
- The [`wrangler`](https://developers.cloudflare.com/workers/wrangler/) CLI (installed as a dev dependency)

### 1. Clone & install

```bash
git clone https://github.com/wanwusangzhigit/signote.git
cd signote
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create note-ms
```

Copy the returned `database_id` into [wrangler.toml](./wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "note-ms"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Apply migrations

```bash
# Local development database
npm run db:migrate:local

# Production (remote) database
npm run db:migrate
```

### 4. Run locally

```bash
npm run dev
# → http://localhost:8787
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Enable the admin panel (optional)

The admin panel stays disabled until you set a secret:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

Then visit `/admin` and sign in. To attach a custom domain, uncomment and edit the `routes` block in [wrangler.toml](./wrangler.toml).

---

## ⚙️ Configuration

All secrets are provided through the Workers environment — **nothing sensitive is stored in the repository**.

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `DB` | D1 binding | ✅ | D1 database binding (configured in `wrangler.toml`). |
| `ADMIN_PASSWORD` | Secret | — | Enables `/admin` when set. If unset, the panel is disabled. |

Runtime-tunable settings live in the `settings` table and are editable from the admin panel:

| Key | Default | Description |
|-----|---------|-------------|
| `max_chars` | `100000` | Maximum content length per note. |
| `random_id_len` | `4` | Length of auto-generated note IDs (2–32). |
| `contact_email` | — | Contact email shown in the site footer. |

---

## 📡 API Reference

| Method | Path | Description |
|:------:|------|-------------|
| `GET` | `/:id` | Open the note page (web editor + preview). |
| `POST` | `/:id` | Save from the web editor. Supports partial updates. |
| `PUT` | `/:id/put` | Upload raw content from the body (curl-friendly). |
| `GET` | `/:id/content` | Fetch note content as JSON (supports `?password=`). |
| `GET` | `/:id/raw` | Fetch note content as `text/plain`. |
| `GET` | `/:id/img` | Render the note as an **SVG image**. |
| `GET` | `/:id/dl` | Download the note as a file. |

### curl upload

```bash
# Create / overwrite a note
echo "hello world" | curl -T - https://your-host/my-note/put

# With a password and a 1-day TTL
echo "secret" | curl -T - "https://your-host/my-note/put?password=hunter2&ttl=1d"

# Protect an existing note (auth) and update its content
echo "updated" | curl -T - "https://your-host/my-note/put?password=hunter2"
```

### SVG image export

```bash
# Default: transparent background
curl https://your-host/my-note/img

# Custom background color (URL-encoded hex)
curl "https://your-host/my-note/img?bg=%230d1117"
```

| Query param | Example | Description |
|-------------|---------|-------------|
| `bg` | `%23ffffff` | Background fill color. Omit for **transparent**. Text/theme auto-adjusts to the background luminance. |
| `password` | `hunter2` | Required if the note is password-protected. |

### TTL format

`ttl` accepts a number of seconds or a suffixed duration: `30s`, `10m`, `24h`, `7d`. The maximum is **30 days**.

---

## 🔐 Write Authorization Model

Editing rules are intentionally simple and always recoverable — a locked note is guaranteed to become editable again once its TTL expires.

| Note state | Who can edit |
|------------|--------------|
| Does not exist | **Anyone** (creates it) |
| Expired | **Anyone** (overwrites with a fresh note) |
| `readonly = 1` | **Nobody** (frozen until expiry) |
| Password-protected | Only the holder of the **current password** |
| Open (no password, not readonly) | **Anyone** |

> Setting a password or read-only mode **without an explicit TTL** auto-defaults to a 30-day expiry, guaranteeing the lock eventually releases.

---

## 🛠️ Admin Panel

Available at `/admin` once `ADMIN_PASSWORD` is set.

- **Notes** — list, inspect, edit, and bulk-delete notes.
- **Settings** — tune `max_chars`, `random_id_len`, and `contact_email`.
- **IP bans** — ban or unban client IPs (with optional expiry).
- **Audit log** — review every read/write operation with IP, user-agent, and fingerprint.

---

## 📁 Project Structure

```
signote/
├── migrations/            # Versioned D1 SQL migrations
│   ├── 0001_initial.sql
│   ├── 0002_default_settings.sql
│   ├── 0003_device_fingerprint_and_logs.sql
│   ├── 0004_note_metadata.sql
│   └── 0005_readonly.sql
├── src/
│   ├── index.js           # Worker entry point + router
│   ├── db.js              # D1 wrapper & data-access helpers
│   ├── auth.js            # Admin session & note password hashing
│   ├── middleware.js      # IP extraction, bans, device fingerprint
│   ├── utils.js           # Shared helpers
│   ├── pages/             # HTML page templates
│   │   ├── home.js
│   │   ├── note.js
│   │   └── admin.js
│   └── routes/            # HTTP handlers
│       ├── home.js
│       ├── note.js        # Markdown/SVG rendering + syntax highlighter
│       └── admin.js
├── wrangler.toml          # Worker & D1 configuration
├── package.json
├── LICENSE
└── CONTRIBUTING.md
```

### npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the local development server. |
| `npm run deploy` | Deploy the Worker to Cloudflare. |
| `npm run db:create` | Create the D1 database. |
| `npm run db:migrate` | Apply migrations to the remote database. |
| `npm run db:migrate:local` | Apply migrations locally. |
| `npm run db:new` | Scaffold a new migration file. |

---

## 🤝 Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests alike.
Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** before opening an issue or PR.

---

## 📄 License

Released under the **[MIT License](./LICENSE)**.

---

## 🇨🇳 中文说明

**signote** 是一个运行在 **Cloudflare Workers + D1** 上的轻量级 Markdown 粘贴板。

- 📝 **Markdown 渲染** —— 标题、列表、引用、链接、行内格式一应俱全。
- 🎨 **代码高亮** —— 零依赖服务端高亮器，支持 **15+ 种语言**。
- ∑ **KaTeX 数学公式** —— 支持块级 `$$ … $$` 与行内 `$ … $`，网页预览与导出一致。
- 🖼️ **SVG 图片导出** —— 通过 `/img` 将笔记导出为自包含的 SVG 图片，默认透明背景，可用 `?bg=` 指定颜色。
- 🔒 **隐私控制** —— 单篇 **密码**、**只读**、**保留时间（TTL，最长 30 天）**，过期后不可访问但内容不删除。
- 🛡️ **防滥用** —— IP 封禁、操作审计日志、设备指纹、内容长度上限。
- ⚙️ **后台管理** —— 设置 `ADMIN_PASSWORD` 后访问 `/admin`，管理笔记、设置、日志与 IP 封禁。
- 🌍 **中英双语界面**，**零运行时依赖**。

快速开始、API 与配置说明请参见上方英文文档。欢迎提交 Issue 与 PR！

<div align="center">

---

**signote** · built with ☕ on the edge.

</div>
