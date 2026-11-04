# mdstudio

Markdown interpreter and editor. Plain HTML, CSS and vanilla JS, no build step.

→ Stage 1: editor + live preview, local files, front matter (`layout`, `theme`, `toc`), IndexedDB autosave, code mode, file tree and tabs.
→ Stage 2: Google Drive source. Stage 3: GitHub source.
→ Vendored in `assets/vendor/`: marked, DOMPurify, highlight.js.
→ Deploy: Vercel project `mdstudio`, workflow runs only if the `VERCEL_TOKEN` secret is set.
