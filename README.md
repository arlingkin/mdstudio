<div align="center">

<img src="assets/icons/logo.svg" width="88" alt="mdstudio logo">

# mdstudio

**A lightweight Markdown workspace in plain HTML, CSS and vanilla JavaScript.**
Write, preview, organize and sync — no framework, no build step.

[![Live](https://img.shields.io/badge/live-mdstudios.vercel.app-0a1020?style=for-the-badge&logo=vercel&logoColor=white)](https://mdstudios.vercel.app)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-vanilla%20JS-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](#-tech-stack)
[![Deploy](https://img.shields.io/badge/deploy-Vercel-000?style=for-the-badge&logo=vercel&logoColor=white)](#-deployment)

[**Open the app**](https://mdstudios.vercel.app) · [**Guide**](https://mdstudios.vercel.app/guide) · [**Privacy**](https://mdstudios.vercel.app/privacy) · [**Terms**](https://mdstudios.vercel.app/terms)

</div>

---

> **Status:** Google Drive and GitHub source integrations are implemented.

## ✨ Features

| | Feature | Details |
| :-: | --- | --- |
| 👁️ | **Live preview** | Edit Markdown and see the rendered document alongside it. |
| 🪟 | **Multiple views** | Switch between `editor`, `split` and `preview`. |
| 📁 | **Local workspace** | Open files and folders, use the file tree, work across tabs. |
| 💾 | **Autosave** | Drafts are kept in the browser with IndexedDB. |
| 🎨 | **Code highlighting** | Highlighted editing and rendered code blocks. |
| 🧾 | **Front matter** | Metadata such as `layout`, `theme` and `toc`. |
| 🌗 | **Themes & language** | Dark/light themes, English/Indonesian interface. |
| <img src="assets/icons/google-drive.svg" width="18" alt=""> | **Google Drive** | Browse Drive files and save documents after signing in. |
| <img src="assets/icons/github.svg" width="18" alt=""> | **GitHub** | Load a repo, tree or blob link lazily, edit, run `index.html` in a sandboxed preview, then commit and push. |

## 🧭 How it works

| Step | What you do | Where it goes |
| --- | --- | --- |
| **1 · Pick a source** | Create or open files, or load a repo / Drive file | <img src="assets/icons/logo.svg" width="18" alt=""> This device (IndexedDB) · <img src="assets/icons/google-drive.svg" width="18" alt=""> Google Drive · <img src="assets/icons/github.svg" width="18" alt=""> GitHub |
| **2 · Write & preview** | Type on the left, read the result on the right | `editor` · `split` · `preview` |
| **3 · Save & sync** | `Ctrl/Cmd+S`, or let autosave run | Browser · `to drive` · `commit & push` |

The toolbar groups actions by scope, each with a mini logo and a thin divider: browser & device, Google Drive (autosave applies here only), GitHub, and view.

The status bar shows words, characters, lines and rendered elements; the info button opens full document and workspace details. Loaded GitHub repositories can be removed from the workspace (trash icon in the sidebar or on any folder); nothing is deleted on GitHub.

Desktop and mobile have separate layouts: sidebar, status bar, draggable divider and focus mode on desktop; bottom bar, file drawer and action sheet on mobile.

### ⌨️ Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd` + `K` | Command palette |
| `Ctrl/Cmd` + `S` | Save |
| `Ctrl/Cmd` + `O` | Open |
| `Ctrl/Cmd` + `B` / `I` | Bold / italic |
| `Ctrl/Cmd` + `\` | Toggle sidebar |
| `Ctrl/Cmd` + `Shift` + `F` | Focus mode |
| `Esc` | Close panels |

Full tutorials for web, desktop and mobile: [`/guide`](https://mdstudios.vercel.app/guide).

## 💡 Why mdstudio?

→ **Lightweight** — no framework and no build pipeline.
→ **Browser-first** — local documents are stored in the browser.
→ **Focused** — Markdown writing and document organization in a single interface.
→ **Extensible** — designed to add external document sources over time.

## 🚀 Getting started

**Use it online:** [mdstudios.vercel.app](https://mdstudios.vercel.app)

### Run locally

mdstudio uses browser APIs and an optional serverless authentication flow, so the simplest local preview is a static HTTP server. With Python installed:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

> [!NOTE]
> Local editing and preview run as a static site. Google Drive sign-in requires the deployed authentication endpoints and OAuth configuration.

## ☁️ Google Drive setup

Authentication uses Vercel Functions and the OAuth 2.0 authorization code flow with PKCE. Configure these environment variables in your Vercel project:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `COOKIE_KEY` | Secret used to protect the authentication cookie |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis REST credentials for the visitor counter (also accepted: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). Without them the counter stays hidden |
| `VISIT_SALT` | Optional salt for the visitor counter hash; falls back to `COOKIE_KEY` |

Set the OAuth redirect URI (also in Google Cloud Console) to:

```
https://<your-domain>/api/auth/callback
```

The app requests Drive access and stores the refresh token in an encrypted, HTTP-only cookie.

## <img src="assets/icons/github.svg" width="22" alt=""> GitHub source

Paste `user/repo`, `github.com/user/repo`, or a `/tree/<branch>/<path>` or `/blob/<branch>/<path>` link.
Shareable route: `?repo=user/repo&ref=branch&path=file`.

→ Files load lazily from raw.githubusercontent.com and are cached in IndexedDB. Binary and large files are not downloaded.
→ `run` previews the nearest `index.html` in a sandboxed iframe served from `/sandbox/` with its own CSP. No npm or build step.
→ `commit & push` makes one atomic commit without force. If the remote changed, nothing is overwritten.
→ The optional fine-grained token (private repos and push) lives only in `sessionStorage` for the tab.

## 🧱 Tech stack

| Component | Technology |
| --- | --- |
| Interface | HTML, CSS, vanilla JavaScript |
| Markdown parsing | [marked](https://github.com/markedjs/marked) |
| HTML sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) |
| Syntax highlighting | [highlight.js](https://github.com/highlightjs/highlight.js) |
| Diagrams | [Mermaid](https://github.com/mermaid-js/mermaid) |
| Local persistence | IndexedDB |
| Drive authentication | Vercel Functions + Google OAuth |
| Deployment | Vercel |

Third-party libraries are vendored in `assets/vendor/`; license notices are in `assets/vendor/LICENSES.txt`.
Icons live in `assets/icons/` (sprite + standalone logos): [Lucide](https://lucide.dev) (ISC) and [Simple Icons](https://simpleicons.org) (CC0) for the GitHub and Google Drive marks, which remain trademarks of their owners. See `assets/icons/LICENSES.txt`.

## 🗺️ Roadmap

- [x] Markdown editor and live preview
- [x] Editor / split / preview modes
- [x] Local file and folder workflow
- [x] Tabs and file tree
- [x] IndexedDB autosave
- [x] Front matter support
- [x] Google Drive integration
- [x] GitHub source integration

## 📦 Deployment

The repository includes a Vercel deployment workflow at `.github/workflows/vercel-deploy.yml`. It runs when the `VERCEL_TOKEN` repository secret is configured.

## 🤝 Contributing

Issues, ideas and improvements are welcome. Before proposing a large change, please open an issue to discuss its scope.

## 🔒 Privacy & terms

[Privacy policy](https://mdstudios.vercel.app/privacy) · [Terms of service](https://mdstudios.vercel.app/terms)

## 📄 License

Copyright © 2026 [arlingkin](https://arlingkin.vercel.app). Released under the [GNU General Public License v3](LICENSE).
