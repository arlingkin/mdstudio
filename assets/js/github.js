(() => {
'use strict';
const M = window.MD, { S, t, toast, persist, DB } = M;
const $ = s => document.querySelector(s);
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, REPO = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/, REF = /^[A-Za-z0-9._-]{1,100}$/;
const safePath = p => p.split('/').every(s => s && s !== '.' && s !== '..' && !/[\\\0]/.test(s));
function parseGh(raw) {
  const s = String(raw).trim();
  let m = /^(?:https:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+?)(?:\.git)?(?:\/(tree|blob)\/([^/\s?#]+)(?:\/([^\s?#]*?))?)?\/?(?:[?#]\S*)?$/i.exec(s);
  let o;
  if (m) o = { user: m[1], repo: m[2], kind: m[3] || '', ref: m[4] || '', path: m[5] || '' };
  else if ((m = /^([^/\s]+)\/([^/\s]+)$/.exec(s))) o = { user: m[1], repo: m[2], kind: '', ref: '', path: '' };
  else return null;
  try { o.ref = o.ref && decodeURIComponent(o.ref); o.path = o.path && decodeURIComponent(o.path).replace(/\/+$/, ''); } catch { return null; }
  if (!NAME.test(o.user) || !REPO.test(o.repo) || (o.ref && !REF.test(o.ref)) || (o.path && !safePath(o.path))) return null;
  return o;
}
M.parseGh = parseGh;

const enc = p => p.split('/').map(encodeURIComponent).join('/');
const ext = p => (/\.([^./]+)$/.exec(p) || [, ''])[1].toLowerCase();
const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const join = (dir, rel) => { const out = dir.split('/').filter(Boolean); for (const s of rel.split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); } return out.join('/'); };
const GM = { ghrate: 'gh.err.rate', ghnotfound: 'gh.err.notfound', ghdenied: 'gh.err.denied', ghconflict: 'gh.err.conflict' };
const gm = e => GM[e.message] ? t(GM[e.message]) : M.errMsg(e);
const groups = new Map();
const saveGroups = () => DB.setMeta('gh', Object.fromEntries(groups)).catch(() => {});
let tok = '';
try { tok = sessionStorage.getItem('mdstudio-ghtok') || ''; } catch {}
const need = () => { $('#gh-tok').open = true; };

async function gh(path, o = {}) {
  const r = await fetch('https://api.github.com' + path, { ...o, headers: { Accept: 'application/vnd.github+json', ...(tok && { Authorization: 'Bearer ' + tok }), ...(o.body && { 'Content-Type': 'application/json' }) } });
  const rem = r.headers.get('X-RateLimit-Remaining');
  if (rem !== null) $('#gh-rate').textContent = t('gh.rate', { n: rem });
  if (!r.ok) {
    const e = new Error(r.status === 403 || r.status === 429 ? (rem === '0' ? 'ghrate' : 'ghdenied') : r.status === 404 ? 'ghnotfound' : r.status === 409 || r.status === 422 ? 'ghconflict' : 'err');
    if (e.message === 'ghrate' || e.message === 'ghnotfound') need();
    throw e;
  }
  return r.status === 204 ? null : r.json();
}
async function ghFetch(f, as) {
  const g = groups.get(f.src.key);
  if (!g) throw new Error('err');
  const p = enc(f.src.rpath);
  const r = tok
    ? await fetch(`https://api.github.com/repos/${g.user}/${g.repo}/contents/${p}?ref=${g.head}`, { headers: { Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer ' + tok } })
    : await fetch(`https://raw.githubusercontent.com/${g.user}/${g.repo}/${g.head}/${p}`);
  if (!r.ok) { const e = new Error(r.status === 404 ? 'ghnotfound' : 'err'); if (r.status === 404) need(); throw e; }
  return as === 'blob' ? r.blob() : r.text();
}
function syncUrl(f) {
  const g = groups.get(f.src.key);
  if (g) try { history.replaceState(null, '', `?repo=${g.user}/${g.repo}&ref=${encodeURIComponent(g.ref)}&path=${encodeURIComponent(f.src.rpath)}`); } catch {}
}
M.beforeOpen = async p => {
  const f = S.files.get(p);
  if (!f || f.src.type !== 'github') return;
  if (f.src.state === 'skipped') { toast(t('gh.skipped')); return false; }
  try {
    if (f.src.state === 'remote') { f.content = await ghFetch(f); f.src.state = 'loaded'; persist(f); }
  } catch (e) { toast(gm(e)); return false; }
  syncUrl(f);
};

function renderRepos() {
  const ul = $('#gh-repos');
  if (!ul) return;
  const rows = [...groups.values()].map(g => {
    const n = [...S.files.keys()].filter(p => p.startsWith(g.key + '/')).length;
    const li = document.createElement('li'), nm = document.createElement('span'), c = document.createElement('small'), rm = document.createElement('button');
    nm.className = 'rn'; nm.textContent = `${g.user}/${g.repo}@${g.ref}`; nm.title = nm.textContent;
    c.textContent = t('gh.files', { n });
    rm.type = 'button'; rm.className = 'rm'; rm.dataset.key = g.key; rm.title = rm.ariaLabel = t('rm.title');
    rm.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/assets/icons/sprite.svg#trash-2"/></svg>';
    li.append(nm, c, rm);
    return n ? li : null;
  }).filter(Boolean);
  ul.replaceChildren(...rows);
}
$('#gh-repos').addEventListener('click', e => {
  const r = e.target.closest('.rm');
  if (r) M.remove([...S.files.keys()].filter(p => p.startsWith(r.dataset.key + '/')));
});
M.afterRender = renderRepos;
M.afterRemove = () => {
  let ch = false;
  for (const k of [...groups.keys()]) if (![...S.files.keys()].some(p => p.startsWith(k + '/'))) { groups.delete(k); ch = true; }
  if (ch) saveGroups();
};
async function clone(o) {
  toast(t('gh.loading'));
  const b = `/repos/${o.user}/${o.repo}`;
  const info = await gh(b);
  const ref = o.ref || info.default_branch;
  const head = (await gh(`${b}/git/ref/${enc('heads/' + ref)}`)).object.sha;
  const dirPath = o.kind === 'tree' ? o.path : '';
  const tr = await gh(`${b}/git/trees/${head}${dirPath ? ':' + enc(dirPath) : ''}?recursive=1`);
  const key = `gh/${o.user}/${o.repo}@${ref.replace(/\//g, '_')}`;
  groups.set(key, { key, user: o.user, repo: o.repo, ref, head });
  saveGroups();
  const list = [];
  for (const e of tr.tree) {
    if (e.type !== 'blob') continue;
    const rpath = dirPath ? dirPath + '/' + e.path : e.path, path = key + '/' + rpath, old = S.files.get(path);
    if (old && (old.dirty || (old.src.sha === e.sha && old.src.state === 'loaded'))) continue;
    const state = BIN_OR_BIG(rpath, e.size) ? 'skipped' : 'remote';
    const f = { path, content: '', src: { type: 'github', key, rpath, sha: e.sha, size: e.size, mode: e.mode, state }, dirty: false, ro: true, updated: Date.now() };
    S.files.set(path, f);
    list.push(f);
  }
  await DB.putMany(list).catch(() => {});
  if (tr.truncated) toast(t('gh.truncated'));
  else toast(t('gh.loaded', { n: list.length, r: `${o.user}/${o.repo}` }));
  const all = [...S.files.keys()].filter(p => p.startsWith(key + '/'));
  const want = o.kind === 'blob' && S.files.has(key + '/' + o.path) ? key + '/' + o.path
    : (all.filter(p => /(^|\/)readme\.md$/i.test(p)).sort((a, b) => a.length - b.length)[0] || all.find(p => S.files.get(p).src.state !== 'skipped'));
  M.renderAll();
  if (want) await M.openTab(want);
}
const BIN_OR_BIG = (p, size) => M.BIN.test(p) || size > M.MAXB;

async function go(raw) {
  const o = parseGh(raw);
  if (!o) { toast(t('gh.invalid')); return; }
  try { await clone(o); } catch (e) { toast(gm(e)); }
}

async function commit() {
  const f = M.cur();
  const key = f && [...groups.keys()].find(k => f.path.startsWith(k + '/'));
  if (!key) { toast(t('gh.nogroup')); return; }
  if (!tok) { need(); toast(t('gh.needtok')); return; }
  const g = groups.get(key);
  const files = [...S.files.values()].filter(x => x.dirty && x.path.startsWith(key + '/') && (x.src.type === 'github' || x.src.type === 'draft'));
  if (!files.length) { toast(t('gh.nochange')); return; }
  const msg = prompt(t('gh.msg'), 'Update via mdstudio');
  if (!msg) return;
  const b = `/repos/${g.user}/${g.repo}`, rf = enc('heads/' + g.ref);
  try {
    const remote = await gh(`${b}/git/ref/${rf}`);
    if (remote.object.sha !== g.head) throw new Error('ghconflict');
    const baseTree = (await gh(`${b}/git/commits/${g.head}`)).tree.sha;
    const done = [], tree = [];
    for (const x of files) {
      const rp = x.src.rpath || x.path.slice(key.length + 1);
      const bl = await gh(`${b}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: x.content, encoding: 'utf-8' }) });
      tree.push({ path: rp, mode: x.src.mode || '100644', type: 'blob', sha: bl.sha });
      done.push([x, rp, bl.sha]);
    }
    const tr = await gh(`${b}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
    const cm = await gh(`${b}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: tr.sha, parents: [g.head] }) });
    await gh(`${b}/git/refs/${rf}`, { method: 'PATCH', body: JSON.stringify({ sha: cm.sha, force: false }) });
    g.head = cm.sha;
    saveGroups();
    for (const [x, rp, sha] of done) {
      x.dirty = false;
      x.src = { type: 'github', key, rpath: rp, sha, size: x.content.length, mode: x.src.mode, state: 'loaded' };
      persist(x);
    }
    M.renderAll();
    toast(t('gh.done', { n: done.length, s: cm.sha.slice(0, 7) }));
  } catch (e) { toast(gm(e)); }
}

const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };
const fr = $('#runframe'), doc = $('#doc'), app = $('#app');
let lastUrls = [];
function stopRun() {
  if (!app.dataset.run) return;
  delete app.dataset.run;
  fr.hidden = true;
  fr.removeAttribute('src');
  doc.hidden = false;
  lastUrls.forEach(u => URL.revokeObjectURL(u));
  lastUrls = [];
}
M.stopRun = stopRun;
async function runPreview() {
  if (app.dataset.run) { stopRun(); return; }
  const f = M.cur();
  if (!f) return;
  const root = (/^gh\/[^/]+\/[^/]+@[^/]+/.exec(f.path) || [''])[0];
  let dir = dirOf(f.path), idx = '';
  for (;;) {
    const p = (dir ? dir + '/' : '') + 'index.html';
    if (S.files.has(p)) { idx = p; break; }
    if (!dir || dir === root) break;
    dir = dirOf(dir);
  }
  if (!idx) { toast(t('gh.noindex')); return; }
  if (await M.beforeOpen(idx) === false) return;
  const cache = new Map(), idir = dirOf(idx);
  const load = (p, depth) => {
    if (!cache.has(p)) cache.set(p, (async () => {
      const x = S.files.get(p);
      if (!x) return null;
      const e = ext(p), type = MIME[e] || 'application/octet-stream', text = /^text\/|json|svg/.test(type);
      let part = x.content;
      if (x.src.type === 'github' && x.src.state !== 'loaded') {
        if (text && x.src.state === 'remote') { part = await ghFetch(x); x.content = part; x.src.state = 'loaded'; persist(x); }
        else if (!text && x.src.size <= 5242880) part = await ghFetch(x, 'blob');
        else return null;
      }
      if (e === 'css' && depth < 3) part = await rewriteCss(part, dirOf(p), depth + 1);
      return URL.createObjectURL(new Blob([part], { type }));
    })().catch(() => null));
    return cache.get(p);
  };
  const resolve = async (ref, from, depth) => {
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
    const rel = ref.split(/[?#]/)[0], p = rel[0] === '/' ? join(root, rel.slice(1)) : join(from, rel);
    return root && p !== root && !p.startsWith(root + '/') ? null : load(p, depth);
  };
  const rewriteCss = async (css, from, depth) => {
    const re = /url\(\s*(['"]?)([^)'"]+?)\1\s*\)/g;
    const rs = await Promise.all([...css.matchAll(re)].map(m => resolve(m[2], from, depth)));
    let i = 0;
    return css.replace(re, a => { const r = rs[i++]; return r ? `url("${r}")` : a; });
  };
  const d = new DOMParser().parseFromString(S.files.get(idx).content, 'text/html');
  await Promise.all([...d.querySelectorAll('[src],[href],[poster]')].filter(n => !/^(a|area|base)$/i.test(n.tagName)).flatMap(n => ['src', 'href', 'poster'].filter(a => n.hasAttribute(a)).map(async a => {
    const u = await resolve(n.getAttribute(a), idir, 0);
    if (u) n.setAttribute(a, u);
  })));
  await Promise.all([...d.querySelectorAll('style')].map(async s => { s.textContent = await rewriteCss(s.textContent, idir, 1); }));
  d.querySelectorAll('meta[http-equiv]').forEach(m => m.remove());
  const urls = (await Promise.all(cache.values())).filter(Boolean);
  stopRun();
  lastUrls = urls;
  app.dataset.run = '1';
  doc.hidden = true;
  fr.hidden = false;
  fr.onload = () => fr.contentWindow.postMessage({ html: '<!doctype html>' + d.documentElement.outerHTML }, '*');
  fr.src = '/sandbox/?' + Date.now();
}

async function toDrive() {
  const f = M.cur();
  if (!f) return;
  const dir = dirOf(f.path);
  const files = dir && confirm(t('gh.scope', { d: dir })) ? [...S.files.values()].filter(x => x.path.startsWith(dir + '/')) : [f];
  const D = M.drive, ids = new Map();
  const esc = s => s.replace(/[\\']/g, '\\$&');
  const find = async (name, pid, folder) => {
    const q = encodeURIComponent(`name='${esc(name)}' and '${pid}' in parents and trashed=false and mimeType${folder ? '=' : '!='}'${D.FOLDER}'`);
    return ((await (await D.dapi(`${D.G}/files?q=${q}&fields=files(id)&pageSize=1`)).json()).files[0] || {}).id || null;
  };
  const folder = async (name, pid) => (await find(name, pid, true)) || (await (await D.dapi(`${D.G}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: D.FOLDER, parents: [pid] }) })).json()).id;
  let n = 0, skipped = 0;
  try {
    await D.driveToken();
    for (const x of files.slice(0, 100)) {
      const tmp = '~copy/' + x.path;
      try {
        if (x.src.type === 'github' && x.src.state !== 'loaded') {
          if (x.src.state === 'skipped') throw new Error('skip');
          x.content = await ghFetch(x); x.src.state = 'loaded'; persist(x);
        }
        const parts = x.path.split('/'), name = parts.pop();
        let pid = 'root', acc = '';
        for (const s of parts) { acc += '/' + s; if (!ids.has(acc)) ids.set(acc, await folder(s, pid)); pid = ids.get(acc); }
        S.files.set(tmp, { path: tmp, content: x.content, src: { type: 'drive', id: await find(name, pid, false) || undefined } });
        await D.DriveSource.write(tmp, x.content, true, pid);
        n++;
      } catch (e) { if (e.message === 'ghrate') throw e; skipped++; } finally { S.files.delete(tmp); }
    }
    toast(t('gh.copied', { n, s: skipped ? t('msg.skipped', { n: skipped }) : '' }));
  } catch (e) { toast(gm(e)); }
}

$('#gh-go').addEventListener('click', () => go($('#gh-url').value));
$('#gh-url').addEventListener('keydown', e => { if (e.key === 'Enter') go(e.target.value); });
$('#gh-commit').addEventListener('click', commit);
$('#gh-run').addEventListener('click', () => runPreview().catch(e => toast(gm(e))));
$('#gh-todrive').addEventListener('click', toDrive);
$('#gh-tokset').addEventListener('click', () => {
  tok = $('#gh-tokin').value.trim();
  $('#gh-tokin').value = '';
  try { if (tok) sessionStorage.setItem('mdstudio-ghtok', tok); else sessionStorage.removeItem('mdstudio-ghtok'); } catch {}
  toast(t(tok ? 'gh.tokok' : 'gh.tokclear'));
});

(async () => {
  try { const m = await DB.getMeta('gh'); if (m) Object.entries(m).forEach(([k, v]) => groups.set(k, v)); } catch {}
  await M.ready;
  renderRepos();
  const f = M.cur();
  if (f && f.src.type === 'github' && f.src.state === 'remote' && await M.beforeOpen(f.path) !== false) M.renderAll();
  const q = new URLSearchParams(location.search), o = q.get('repo') && parseGh(q.get('repo'));
  if (!o) return;
  const ref = q.get('ref') || '', path = q.get('path') || '';
  if ((ref && !REF.test(ref)) || (path && !safePath(path))) return;
  try { await clone({ ...o, kind: path ? 'blob' : '', ref, path }); } catch (e) { toast(gm(e)); }
})();
})();
