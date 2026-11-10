<p align="center"><img src="assets/icons/logo.svg" width="72" alt="mdstudio logo"></p>

# mdstudio

**A lightweight Markdown workspace built with plain HTML, CSS, and vanilla JavaScript.**

Write Markdown, preview it live, organize local files, and connect Google Drive—all from a browser-based editor with no build step.

> **Project status:** Google Drive and GitHub source integrations are implemented.

## Overview

mdstudio brings the essentials of Markdown writing into one focused workspace:

- **Live preview** — edit Markdown and see the rendered document alongside it.
- **Multiple views** — switch between editor, split, and preview modes.
- **Local workspace** — open files and folders, navigate a file tree, and work across tabs.
- **Autosave** — keep drafts in browser storage with IndexedDB.
- **Code highlighting** — syntax-highlighted editing and rendered code blocks.
- **Front matter** — support for document metadata such as `layout`, `theme`, and `toc`.
- **Themes & language** — dark/light themes and English/Indonesian interface.
- **Google Drive** — browse Drive files and save documents to Drive after signing in.
- **GitHub** — paste a repo, tree or blob link to load files lazily, edit, run `index.html` in a sandboxed preview, and commit and push.

## How it works

| Step | What you do | Where it goes |
| --- | --- | --- |
| **1. Pick a source** | Create or open files, or load a repo/Drive file | <img src="assets/icons/logo.svg" width="18" alt=""> This device (IndexedDB) · <img src="assets/icons/google-drive.svg" width="18" alt=""> Google Drive · <img src="assets/icons/github.svg" width="18" alt=""> GitHub |
| **2. Write & preview** | Type on the left, read the rendered result on the right | Modes: `editor` · `split` · `preview` |
| **3. Save & sync** | `Ctrl/Cmd+S`, or let autosave run | Browser · `to drive` · `commit & push` |

The toolbar groups actions by scope, each with a mini logo and a thin divider: browser & device, Google Drive (autosave applies here only), GitHub, and view.

The status bar shows words, characters, lines and rendered elements; the info button opens full document and workspace details. Loaded GitHub repositories can be removed from the workspace (trash icon in the sidebar or on any folder); nothing is deleted on GitHub.

Desktop and mobile have separate layouts: sidebar, status bar, draggable divider and focus mode on desktop; bottom bar, file drawer and action sheet on mobile.

Keyboard: `Ctrl/Cmd+K` command palette · `Ctrl/Cmd+S` save · `Ctrl/Cmd+O` open · `Ctrl/Cmd+B` / `I` bold / italic · `Ctrl/Cmd+\` sidebar · `Ctrl/Cmd+Shift+F` focus mode · `Esc` closes panels.

Full tutorials for web, desktop and mobile: [`/guide`](/guide).

## Why mdstudio?

- **Lightweight:** no framework and no build pipeline.
- **Browser-first:** local documents are stored in the browser.
- **Focused:** Markdown writing and document organization in a single interface.
- **Extensible:** designed to add external document sources over time.

## Getting started
### Live At
| **visit 👉** | [mdstudios](/) |
| --- | --- |
### Run locally

Because mdstudio uses browser APIs and includes an optional serverless authentication flow, the simplest local preview is to serve the project directory with a static HTTP server.

For example, with Python installed:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

> Local editing and preview can run as a static site. Google Drive sign-in requires the deployed authentication endpoints and OAuth configuration.

## Google Drive setup

Google Drive authentication uses Vercel Functions and OAuth 2.0 authorization code flow with PKCE.

Configure these environment variables in your Vercel project:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `COOKIE_KEY` | Secret used to protect the authentication cookie |

Set the OAuth redirect URI to:

```
https://<your-domain>/api/auth/callback
```

Also configure the matching redirect URI in Google Cloud Console. The application requests Drive access and stores the refresh token in an encrypted, HTTP-only cookie.

## GitHub source

Paste `user/repo`, `github.com/user/repo`, or a `/tree/<branch>/<path>` or `/blob/<branch>/<path>` link. Shareable route: `?repo=user/repo&ref=branch&path=file`.

→ Files load lazily from raw.githubusercontent.com and are cached in IndexedDB. Binary and large files are not downloaded.
→ `run` previews the nearest `index.html` in a sandboxed iframe served from `/sandbox/` with its own CSP. No npm or build step.
→ `commit & push` makes one atomic commit without force. If the remote changed, nothing is overwritten.
→ The optional fine-grained token (private repos and push) lives only in `sessionStorage` for the tab.

## Tech stack

| Component | Technology |
| --- | --- |
| Interface | HTML, CSS, vanilla JavaScript |
| Markdown parsing | [marked](https://github.com/markedjs/marked) |
| HTML sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) |
| Syntax highlighting | [highlight.js](https://github.com/highlightjs/highlight.js) |
| Local persistence | IndexedDB |
| Drive authentication | Vercel Functions + Google OAuth |
| Deployment | Vercel |

Third-party libraries are vendored in `assets/vendor/`. See `assets/vendor/LICENSES.txt` for their license notices.

Icons live in `assets/icons/` (sprite + standalone logos): [Lucide](https://lucide.dev) (ISC) and [Simple Icons](https://simpleicons.org) (CC0) for the GitHub and Google Drive marks, which remain trademarks of their owners. See `assets/icons/LICENSES.txt`.

## Roadmap

- [x] Markdown editor and live preview
- [x] Editor / split / preview modes
- [x] Local file and folder workflow
- [x] Tabs and file tree
- [x] IndexedDB autosave
- [x] Front matter support
- [x] Google Drive integration
- [x] GitHub source integration

## Deployment

The repository includes a Vercel deployment workflow at `.github/workflows/vercel-deploy.yml`. It runs when the `VERCEL_TOKEN` repository secret is configured.

## Contributing

Issues, ideas, and improvements are welcome. Before proposing a large change, please open an issue to discuss its scope.

## License

See [LICENSE](LICENSE).

## License

Copyright © 2026 arlingkin. Released under the [GNU General Public License v3](LICENSE).
