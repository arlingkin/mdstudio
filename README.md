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

## Why mdstudio?

- **Lightweight:** no framework and no build pipeline.
- **Browser-first:** local documents are stored in the browser.
- **Focused:** Markdown writing and document organization in a single interface.
- **Extensible:** designed to add external document sources over time.

## Getting started
### Live At
| **visit 👉** | [mdstudios](https://mdstudios.vercel.app) |
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
