<div align="center">

# Contributing to signote

First off — **thank you** for taking the time to contribute! 🎉

We welcome bug reports, feature requests, documentation improvements, and pull requests of all sizes.

</div>

---

## 📜 Code of Conduct

This project follows a simple rule: **be respectful and constructive**. Harassment, discrimination, and hostile behavior are not tolerated. By participating, you agree to keep discussions welcoming and focused on making signote better.

---

## 🐛 Reporting Bugs

Before opening an issue, please **search existing issues** to avoid duplicates.

When filing a bug report, include:

- **A clear, descriptive title.**
- **Steps to reproduce** — the exact commands, URLs, and requests.
- **Expected vs. actual behavior.**
- **Environment** — browser/OS, `wrangler` version, and whether you're testing locally or on a deployed Worker.
- **Logs / screenshots** — any relevant error output or images.

> For **security vulnerabilities**, please **do not** open a public issue. Report them privately to the maintainer (see [Contact](#-contact)) so they can be addressed responsibly.

---

## 💡 Suggesting Features

Feature requests are welcome. A great proposal explains:

- **The problem** you're trying to solve (the "why", not just the "what").
- **The proposed solution** and any alternatives you considered.
- **Scope** — is this a small tweak or a larger addition?

Because signote aims to stay lean and dependency-free, please favor solutions that fit the existing minimalist architecture.

---

## 🧑‍💻 Development Setup

### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/signote.git
cd signote
npm install
```

### 2. Create a local D1 database

```bash
npx wrangler d1 create note-ms
```

Copy the `database_id` into [wrangler.toml](./wrangler.toml), then apply migrations locally:

```bash
npm run db:migrate:local
```

### 3. Start the dev server

```bash
npm run dev
# → http://localhost:8787
```

### 4. Set an admin password (only needed for admin work)

For local development, create a `.dev.vars` file (already git-ignored):

```dotenv
ADMIN_PASSWORD=your-local-password
```

---

## 🌿 Branching & Commit Conventions

- Branch off `main` and give your branch a descriptive name:
  - `feat/note-pinning`, `fix/img-transparent-bg`, `docs/readme-revamp`
- Write clear, focused commit messages. We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  feat: add CSV syntax highlighting
  fix: preserve indentation in SVG export
  docs: document the /dl endpoint
  chore: bump wrangler to 3.79
  ```

- Keep commits **small and logical** — one concern per commit.

---

## 🔧 Making Changes

### Code style

- **Vanilla JavaScript (ES modules)** — no frameworks, no bundlers, no build step.
- Keep the code **dependency-free**. New runtime dependencies need a strong justification.
- Match the surrounding style: 2-space indentation, single quotes, semicolons.
- Prefer small, pure helper functions in [src/utils.js](./src/utils.js) for anything reusable.
- Add a brief comment only where the logic isn't self-evident.

### Database changes

- **Never** edit an applied migration. Instead, add a new one:

  ```bash
  npm run db:new
  ```

- Migrations must be **forward-only** and safe to apply in sequence.

### Rendering & the SVG exporter

The Markdown → HTML → SVG pipeline in [src/routes/note.js](./src/routes/note.js) has a few important constraints — please keep them in mind:

- SVG loaded as an `<img>` **ignores `<style>` tags**, so every element uses **inline styles**.
- `<br>` **must** be self-closed as `<br/>` to keep the SVG valid XML.
- Avoid raw double quotes inside `style` attributes (they break XML parsing).

### Secrets

- **Never** commit credentials, API tokens, account IDs, or database IDs.
- Use `wrangler secret put` for secrets and `.dev.vars` (git-ignored) for local values.
- `wrangler.toml` should contain placeholders only.

---

## ✅ Before You Submit

Please make sure your change:

1. **Runs locally** — `npm run dev` works without errors.
2. **Passes a syntax check** on any file you touched:

   ```bash
   node --check src/index.js
   ```

3. **Is tested** — verify both new and existing behavior, including the affected route(s) in a browser when UI is involved.
4. **Keeps the diff focused** — avoid unrelated refactors or formatting churn.

---

## 📬 Pull Request Process

1. Push your branch to your fork.
2. Open a pull request against `main`.
3. Fill in the PR description:
   - **What** changed and **why**.
   - **How** it was tested (steps, commands, screenshots).
   - Any **linked issues** (`Closes #123`).
4. Ensure **CI checks pass** and the branch is **up to date with `main`**.
5. Respond to review feedback — we aim to keep review friendly and fast.

A maintainer will review your PR, possibly request changes, and merge once it's ready. **Please be patient** — this is a community project.

---

## 🏷️ Good First Issues

New to the project? Look for issues labeled **`good first issue`** or **`help wanted`**. They're scoped to be approachable and are a great way to get started.

---

## 📞 Contact

- **Issues & discussions:** open a [GitHub issue](https://github.com/wanwusangzhigit/signote/issues)
- **Private / security matters:** email the maintainer via the address published on the site footer.

---

<div align="center">

Thanks again for contributing — you make signote better! ⭐

</div>
