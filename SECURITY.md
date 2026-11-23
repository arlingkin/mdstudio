# Security Policy

mdstudio is a client-side Markdown workspace (plain HTML, CSS and vanilla JavaScript) with a small serverless backend on Vercel. This document explains what is covered, how it is protected, and how to report a problem.

## Supported versions

mdstudio is a continuously deployed web app with no versioned releases. Only the latest `main` branch, as served at [mdstudios.vercel.app](https://mdstudios.vercel.app), receives security fixes. Forks and older deployments are not supported.

## Reporting a vulnerability

**Email: [linggasaja03@gmail.com](mailto:linggasaja03@gmail.com)** with the subject `[mdstudio security] <short summary>`.

You can also use GitHub's private reporting: the repository's **Security** tab, then **Report a vulnerability**.

Please do not open a public issue or pull request for a vulnerability. Include:

→ What is affected (page, file, endpoint) and the impact
→ Steps to reproduce, or a minimal proof of concept
→ Browser, OS and the URL tested, if relevant

Never include real tokens, passwords or other people's data in a report.

### What to expect

| Step | Target |
| --- | --- |
| Acknowledgement | within 72 hours |
| Triage and first assessment | within 7 days |
| Status updates | at least every 14 days until resolved |
| Fix for confirmed high or critical issues | as soon as practical, aiming for 30 days |

If the report is accepted, the fix is deployed to `main`, and you are credited in the commit or release notes unless you prefer to stay anonymous. If it is declined (for example, not reproducible, out of scope or intended behavior), you receive an explanation. Please allow up to 90 days before public disclosure so users are protected first.

### Safe harbor

Good-faith research that follows this policy is welcome. Avoid privacy violations, data destruction and service disruption, test only against your own accounts and data, and stop once you have shown the issue.

## Scope

**In scope**

→ The web app: `index.html`, `guide.html`, `privacy.html`, `terms.html`, `assets/`, `sw.js`
→ The preview sandbox: `sandbox/`
→ Serverless endpoints: `api/auth/*` and `api/visit.js`
→ Deployment configuration: `vercel.json` and `.github/workflows/`

**Out of scope**

→ Vulnerabilities in third-party services (Google, GitHub, Vercel) or in bundled libraries that are already fixed upstream; report those to the vendor
→ Findings that need a rooted device, a malicious browser extension or physical access
→ Missing best-practice headers with no demonstrated impact, social engineering, spam and denial-of-service or volume-based attacks
→ Content a user chooses to open or run in their own workspace, within the limits of the sandbox described below

## How mdstudio is protected

→ **Strict CSP and headers:** the app is served with `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a restrictive `Permissions-Policy` and `connect-src` limited to `googleapis.com`, `api.github.com` and `raw.githubusercontent.com`.
→ **Sanitized rendering:** rendered Markdown passes through DOMPurify before reaching the DOM.
→ **Isolated preview:** running a repository's `index.html` happens in a sandboxed iframe on `/sandbox/` with its own CSP (`default-src 'none'`, `connect-src 'none'`), so previewed code cannot call the network or reach the app.
→ **GitHub token:** kept only in `sessionStorage` for the current tab and sent only to `api.github.com`. Prefer a fine-grained token limited to one repository with Contents read/write.
→ **Google Drive sign-in:** OAuth with a `state` value and PKCE verifier. The refresh token is encrypted with AES-256-GCM and stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/auth`; access tokens are never stored by the server. State-changing auth endpoints require `POST` with a custom request header, and all `/api/*` responses are `no-store`.
→ **Local data:** drafts stay in the browser (IndexedDB). "Remove" in the file tree only removes a file from the workspace; it does not delete anything from GitHub, Drive or your device.
→ **Supply chain:** third-party scripts are vendored in `assets/vendor/` (no CDN at runtime), and Dependabot keeps GitHub Actions up to date.

## Advice for users

→ Use a fine-grained, short-lived GitHub token and clear it when you finish
→ Revoke mdstudio's access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) if you stop using Drive sync
→ Only run previews of repositories you trust; the sandbox reduces, but does not remove, the risk of running untrusted code
