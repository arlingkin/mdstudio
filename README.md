# mdstudio

Markdown interpreter and editor. Plain HTML, CSS and vanilla JS, no build step.

→ Stage 1: editor + live preview, local files, front matter (`layout`, `theme`, `toc`), IndexedDB autosave, code mode, file tree and tabs.
→ Stage 2: Google Drive source. Login via Vercel Functions in `api/auth/` (OAuth code + PKCE, scope `drive`, refresh token encrypted in an httpOnly cookie). Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COOKIE_KEY`; redirect URI `https://<domain>/api/auth/callback`.
→ Stage 3: GitHub source.
→ Vendored in `assets/vendor/`: marked, DOMPurify, highlight.js.
→ Deploy: Vercel project `mdstudio`, workflow runs only if the `VERCEL_TOKEN` secret is set.
