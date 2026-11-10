(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let lang = LS.get('mdstudio-lang', /^id/i.test(navigator.language) ? 'id' : 'en');
let theme = LS.get('mdstudio-theme', 'dark') === 'light' ? 'light' : 'dark';
const t = (k, v = {}) => {
  const e = T[k];
  let s = e ? (e[lang] || e.en) : k;
  for (const x in v) s = s.replace('{' + x + '}', v[x]);
  return s;
};

const DB = (() => {
  let db;
  const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => {
    const r = indexedDB.open('mdstudio', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files', { keyPath: 'path' }); r.result.createObjectStore('meta'); };
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
  const tx = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const x = d.transaction(store, mode);
      const rq = fn(x.objectStore(store));
      x.oncomplete = () => res(rq.result);
      x.onerror = () => rej(x.error);
      x.onabort = () => rej(x.error);
    });
  };
  return {
    all: () => tx('files', 'readonly', s => s.getAll()),
    put: f => tx('files', 'readwrite', s => s.put(f)),
    delMany: ps => tx('files', 'readwrite', s => { ps.forEach(p => s.delete(p)); return {}; }),
    putMany: fs => tx('files', 'readwrite', s => { fs.forEach(f => s.put(f)); return {}; }),
    getMeta: k => tx('meta', 'readonly', s => s.get(k)),
    setMeta: (k, v) => tx('meta', 'readwrite', s => s.put(v, k))
  };
})();

const S = { files: new Map(), tabs: [], active: null };
const handles = new Map();
const dirs = new Map();
const hasFS = 'showOpenFilePicker' in window;
const BIN = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|7z|woff2?|ttf|otf|mp[34]|mov|wasm|exe)$/i;
const MAXB = 1048576;
const MAXN = 300;
const LMAP = { js: 'javascript', mjs: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', yml: 'yaml', html: 'xml', htm: 'xml', vue: 'xml', rs: 'rust', kt: 'kotlin' };
const isMd = p => /\.(md|markdown|mdx)$/i.test(p);
const base = p => p.slice(p.lastIndexOf('/') + 1);
const ext = p => (/\.([^./]+)$/.exec(base(p)) || [, ''])[1].toLowerCase();
const cur = () => S.files.get(S.active);
const uniq = p => {
  if (!S.files.has(p)) return p;
  const i = p.lastIndexOf('.');
  const dot = i > p.lastIndexOf('/');
  const a = dot ? p.slice(0, i) : p, b = dot ? p.slice(i) : '';
  let n = 2;
  while (S.files.has(`${a}-${n}${b}`)) n++;
  return `${a}-${n}${b}`;
};

const persist = f => DB.put(f).catch(() => DB.put({ ...f, src: { type: f.src.type } })).catch(() => {});
const saveUI = () => DB.setMeta('ui', { tabs: S.tabs, active: S.active }).catch(() => {});
function addFile(path, content, src = { type: 'draft' }, dirty = false) {
  path = uniq(path);
  const f = { path, content, src, dirty, updated: Date.now() };
  S.files.set(path, f);
  persist(f);
  return f;
}

function download(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  a.download = base(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function walk(dir, prefix, out) {
  for await (const [n, h] of dir.entries()) {
    if (n === '.git' || n === 'node_modules') continue;
    if (h.kind === 'directory') await walk(h, prefix + n + '/', out);
    else out.push({ path: prefix + n, handle: h });
  }
}
const LocalSource = {
  async list(path = '') {
    const out = [];
    for (const [root, d] of dirs) await walk(d, root + '/', out);
    out.forEach(e => handles.set(e.path, e.handle));
    return out.map(e => e.path).filter(p => p.startsWith(path));
  },
  async read(path) {
    const h = handles.get(path);
    if (!h) throw new Error('no handle');
    const file = await h.getFile();
    if (file.size > MAXB) throw new Error('too large');
    return file.text();
  },
  async write(path, content) {
    const h = handles.get(path);
    if (!h) { download(path, content); return 'download'; }
    const o = { mode: 'readwrite' };
    if (await h.queryPermission(o) !== 'granted' && await h.requestPermission(o) !== 'granted') throw new Error('denied');
    const w = await h.createWritable();
    await w.write(content);
    await w.close();
    return 'file';
  }
};

const G = 'https://www.googleapis.com/drive/v3', GU = 'https://www.googleapis.com/upload/drive/v3';
const GF = 'id,name,modifiedTime,version,mimeType,size';
const FOLDER = 'application/vnd.google-apps.folder';
let tok = null;
const dirIds = new Map([['drive', 'root']]);
async function driveToken(quiet) {
  if (tok && tok.exp > Date.now() + 30000) return tok.value;
  const r = await fetch('/api/auth/token', { method: 'POST', headers: { 'X-Requested-With': 'mdstudio' } }).catch(() => null);
  if (!r) throw new Error('nobackend');
  if (r.status === 401) { if (!quiet) location.assign('/api/auth/login'); throw new Error('login'); }
  if (!r.ok) throw new Error(r.status === 500 ? 'nocfg' : 'nobackend');
  const j = await r.json();
  tok = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tok.value;
}
async function dapi(url, o = {}, retry = true) {
  const r = await fetch(url, { ...o, headers: { ...o.headers, Authorization: 'Bearer ' + await driveToken() } });
  if (r.status === 401 && retry) { tok = null; return dapi(url, o, false); }
  if (!r.ok) throw new Error('drive ' + r.status);
  return r;
}
const dmeta = async id => (await dapi(`${G}/files/${id}?fields=${GF}`)).json();
const mimeOf = p => isMd(p) ? 'text/markdown' : 'text/plain';
const stamp = m => ({ version: m.version, modifiedTime: m.modifiedTime });
const DriveSource = {
  async list(path = 'drive') {
    const q = encodeURIComponent(`'${dirIds.get(path) ?? 'root'}' in parents and trashed=false`);
    const out = [];
    let pt = '';
    for (let i = 0; i < 5; i++) {
      const r = await (await dapi(`${G}/files?q=${q}&orderBy=folder,name&pageSize=200&fields=nextPageToken,files(${GF})${pt}`)).json();
      for (const x of r.files) {
        const p = path + '/' + x.name.replace(/\//g, '_'), folder = x.mimeType === FOLDER;
        if (folder) dirIds.set(p, x.id);
        out.push({ ...x, folder, path: p });
      }
      if (!r.nextPageToken) break;
      pt = '&pageToken=' + encodeURIComponent(r.nextPageToken);
    }
    return out;
  },
  async read(path) {
    const f = S.files.get(path), m = await dmeta(f.src.id);
    if (+m.size > MAXB) throw new Error('skip');
    const text = await (await dapi(`${G}/files/${f.src.id}?alt=media`)).text();
    f.src = { ...f.src, ...stamp(m) };
    return text;
  },
  async write(path, content, force, parent) {
    const f = S.files.get(path), id = f.src.id, ct = mimeOf(path) + ';charset=UTF-8';
    if (id && !force) {
      const m = await dmeta(id);
      if (m.version !== f.src.version || m.modifiedTime !== f.src.modifiedTime) { const e = new Error('conflict'); e.conflict = true; throw e; }
    }
    let r;
    if (id) r = await dapi(`${GU}/files/${id}?uploadType=media&fields=${GF}`, { method: 'PATCH', headers: { 'Content-Type': ct }, body: content });
    else {
      const bd = 'mdstudio' + Date.now().toString(36);
      const meta = JSON.stringify({ name: base(path), mimeType: mimeOf(path), ...(parent && { parents: [parent] }) });
      r = await dapi(`${GU}/files?uploadType=multipart&fields=${GF}`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + bd },
        body: `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bd}\r\nContent-Type: ${ct}\r\n\r\n${content}\r\n--${bd}--`
      });
    }
    const m = await r.json();
    f.src = { type: 'drive', id: m.id, ...stamp(m) };
    return m;
  }
};
const EM = { nocfg: 'msg.nodrive', nobackend: 'msg.nobackend', login: 'msg.login', skip: 'msg.unsupported' };
function errMsg(e) { return t(e.conflict ? 'msg.conflictno' : EM[e.message] || 'msg.err'); }

async function importLocal(path, handle) {
  handles.set(path, handle);
  const old = S.files.get(path);
  if (old && old.src.type === 'local') {
    if (old.dirty) return old;
    old.content = await LocalSource.read(path);
    old.src.handle = handle;
    persist(old);
    return old;
  }
  return addFile(path, await LocalSource.read(path), { type: 'local', handle });
}
async function openFiles() {
  if (!hasFS) { $('#file-in').click(); return; }
  try {
    let last, n = 0, skipped = 0;
    for (const h of await showOpenFilePicker({ multiple: true })) {
      let p = h.name;
      const o = S.files.get(p);
      if (o && o.src.handle && !(await o.src.handle.isSameEntry(h))) p = uniq(p);
      try { last = await importLocal(p, h); n++; } catch { skipped++; }
    }
    done(last, n, skipped);
  } catch (e) { if (e.name !== 'AbortError') toast(t('msg.err')); }
}
async function openFolder() {
  try {
    const d = await showDirectoryPicker({ mode: 'readwrite' });
    dirs.set(d.name, d);
    let first, n = 0, skipped = 0;
    for (const p of await LocalSource.list(d.name + '/')) {
      if (BIN.test(p) || n >= MAXN) { skipped++; continue; }
      try { const f = await importLocal(p, handles.get(p)); if (!first || /^[^/]+\/readme\.md$/i.test(p)) first = f; n++; } catch { skipped++; }
    }
    done(first, n, skipped);
  } catch (e) { if (e.name !== 'AbortError') toast(t('msg.err')); }
}
async function importDrive(m, path) {
  if (m.mimeType.startsWith('application/vnd.google-apps') || BIN.test(m.name)) throw new Error('skip');
  let f = [...S.files.values()].find(x => x.src.id === m.id);
  const fresh = !f;
  if (f && f.dirty) return f;
  if (fresh) { f = { path: uniq(path), content: '', src: { type: 'drive', id: m.id }, dirty: false, updated: Date.now() }; S.files.set(f.path, f); }
  try { f.content = await DriveSource.read(f.path); } catch (e) { if (fresh) S.files.delete(f.path); throw e; }
  persist(f);
  return f;
}
async function renderDir(path, ul) {
  ul.replaceChildren();
  for (const x of await DriveSource.list(path)) {
    const li = document.createElement('li');
    if (x.folder) {
      const d = document.createElement('details'), s = document.createElement('summary'), sub = document.createElement('ul');
      s.textContent = x.name;
      d.append(s, sub);
      d.addEventListener('toggle', () => { if (d.open && !d.dataset.loaded) { d.dataset.loaded = '1'; renderDir(x.path, sub).catch(e => toast(errMsg(e))); } });
      li.append(d);
    } else {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'node';
      b.textContent = x.name;
      b.title = x.path;
      b.disabled = x.mimeType.startsWith('application/vnd.google-apps');
      b.addEventListener('click', () => importDrive(x, x.path).then(f => openTab(f.path)).catch(e => toast(errMsg(e))));
      li.append(b);
    }
    ul.append(li);
  }
}
async function openDrive() {
  try {
    await driveToken();
    const ul = document.createElement('ul');
    dtree.replaceChildren(ul);
    dwrap.hidden = false;
    app.classList.add('tree-open');
    await renderDir('drive', ul);
  } catch (e) { toast(errMsg(e)); }
}
async function saveDrive(f, copy) {
  let g = f;
  if (copy && f.src.type !== 'drive') {
    g = { path: uniq('drive/' + base(f.path)), content: f.content, src: { type: 'drive' }, dirty: true, updated: Date.now() };
    S.files.set(g.path, g);
  }
  try {
    try { await DriveSource.write(g.path, g.content); }
    catch (e) { if (!e.conflict || !confirm(t('msg.conflict'))) throw e; await DriveSource.write(g.path, g.content, true); }
  } catch (e) { if (g !== f) S.files.delete(g.path); throw e; }
  g.dirty = false;
  persist(g);
  return g;
}
const saving = new Set(), timers = new Map(), paused = new Map();
let auto = LS.get('mdstudio-auto', '1') === '1';
function syncState() {
  const f = cur(), el = $('#sync');
  $('#btn-rename').disabled = $('#btn-copy').disabled = $('#btn-dup').disabled = !f;
  if (!f || f.src.type !== 'drive') { el.textContent = ''; delete el.dataset.s; return; }
  const st = !navigator.onLine ? 'off' : saving.has(f.path) ? 'syncing' : paused.get(f.path) || (auto ? (f.dirty ? 'syncing' : 'synced') : (f.dirty ? 'unsaved' : 'saved'));
  el.dataset.s = st;
  el.textContent = t('sync.drive') + ' · ' + t('sync.' + st);
}
function sched(f, ms = 2000) {
  clearTimeout(timers.get(f.path));
  if (auto && f.src.type === 'drive' && !paused.has(f.path)) timers.set(f.path, setTimeout(() => autoDrive(f), ms));
}
async function autoDrive(f) {
  timers.delete(f.path);
  if (!auto || !f.dirty || f.src.type !== 'drive' || saving.has(f.path) || paused.has(f.path)) return;
  if (!navigator.onLine) { syncState(); return; }
  saving.add(f.path);
  syncState();
  const c = f.content;
  let retry = false;
  try {
    await driveToken(true);
    await DriveSource.write(f.path, c);
    if (f.content === c) f.dirty = false;
    persist(f);
    renderTabs();
    renderTree();
  } catch (e) {
    if (e.conflict) { paused.set(f.path, 'conflict'); toast(t('msg.conflictno')); }
    else if (e.message === 'login') paused.set(f.path, 'login');
    else retry = true;
  } finally {
    saving.delete(f.path);
    if (f.dirty && !paused.has(f.path)) sched(f, retry ? 10000 : 2000);
    syncState();
  }
}
async function onPicked(files) {
  let last, n = 0, skipped = 0;
  for (const file of files) {
    if (file.size > MAXB || BIN.test(file.name)) { skipped++; continue; }
    last = addFile(file.name, await file.text(), { type: 'local' });
    n++;
  }
  done(last, n, skipped);
}
function done(f, n, skipped) {
  toast(t('msg.opened', { n }) + (skipped ? t('msg.skipped', { n: skipped }) : ''));
  if (f) openTab(f.path); else renderAll();
}
async function save(f = cur(), toDrive = false, device = false) {
  if (!f) return;
  try {
    if (device && (f.src.type === 'drive' || f.src.type === 'github')) { download(f.path, f.content); toast(t('msg.downloaded', { n: base(f.path) })); return; }
    if (f.src.type === 'github' && !toDrive) { toast(t('msg.ghsave')); return; }
    if (toDrive || f.src.type === 'drive') {
      saving.add(f.path);
      let g;
      try { g = await saveDrive(f, toDrive); } finally { saving.delete(f.path); }
      paused.delete(g.path);
      toast(t('msg.saved', { n: base(g.path) }));
      if (g !== f) openTab(g.path); else { renderTabs(); renderTree(); syncState(); }
      return;
    }
    if (!handles.has(f.path) && window.showSaveFilePicker) {
      const h = await showSaveFilePicker({ suggestedName: base(f.path) });
      handles.set(f.path, h);
      f.src = { type: 'local', handle: h };
    }
    const r = await LocalSource.write(f.path, f.content);
    f.dirty = false;
    persist(f);
    renderTabs();
    renderTree();
    toast(t(r === 'file' ? 'msg.saved' : 'msg.downloaded', { n: base(f.path) }));
  } catch (e) { if (e.name !== 'AbortError') toast(errMsg(e)); }
}
async function newFile() {
  const n = prompt(t('prompt.name'), 'untitled.md');
  if (!n) return;
  const p = n.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || /(^|\/)\.\.?(\/|$)/.test(p)) return;
  await openTab(addFile(p, '', { type: 'draft' }, true).path);
  ta.focus();
}

const app = $('#app'), ta = $('#ta'), hlc = $('#hl code'), wrap = $('#wrap'), pv = $('#pv'), doc = $('#doc'), tree = $('#tree'), dwrap = $('#dwrap'), dtree = $('#dtree'), tabsEl = $('#tabs'), status = $('#status');
let toastT;
function toast(m) {
  status.textContent = m;
  clearTimeout(toastT);
  toastT = setTimeout(() => { status.textContent = ''; }, 3500);
}

function parseFM(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { fm: {}, body: src };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/.exec(line);
    if (k) fm[k[1].toLowerCase()] = k[2].replace(/^["']|["']$/g, '').toLowerCase();
  }
  return { fm, body: src.slice(m[0].length) };
}

const SAN = { FORBID_ATTR: ['style'], FORBID_TAGS: ['style'] };
DOMPurify.addHook('afterSanitizeAttributes', n => {
  if (n.tagName === 'IMG' || n.tagName === 'SOURCE') n.removeAttribute('srcset');
  if (n.tagName === 'IMG') {
    const s = n.getAttribute('src') || '';
    if (!/^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i.test(s)) { if (s) n.setAttribute('data-src', s); n.removeAttribute('src'); }
    n.setAttribute('loading', 'lazy');
    n.setAttribute('decoding', 'async');
    n.setAttribute('referrerpolicy', 'no-referrer');
  }
  if (n.tagName === 'A') {
    const h = n.getAttribute('href') || '';
    if (h && h[0] !== '#') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
  }
});
const hlCode = (code, l) => hljs.getLanguage(l) ? hljs.highlight(code, { language: l, ignoreIllegals: true }).value : esc(code);
marked.use({
  gfm: true,
  renderer: {
    code(code, info) {
      const l = (info || '').trim().split(/\s+/)[0];
      return `<pre><code class="hljs${hljs.getLanguage(l) ? ' language-' + esc(l) : ''}">${hlCode(code, l)}</code></pre>`;
    }
  }
});

const IMGT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml' };
const MAXI = 5242880;
const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const joinP = (dir, rel) => { const o = dir.split('/').filter(Boolean); for (const s of rel.split('/')) { if (s === '..') o.pop(); else if (s && s !== '.') o.push(s); } return o.join('/'); };
const rootOf = p => (/^gh\/[^/]+\/[^/]+@[^/]+/.exec(p) || [p.includes('/') ? p.slice(0, p.indexOf('/')) : ''])[0];
const imgCache = new Map(), dlist = new Map();
let imgGen = 0;
function cached(k, mk) {
  if (imgCache.has(k)) return imgCache.get(k);
  const pr = mk().then(b => b && URL.createObjectURL(b)).catch(() => null);
  imgCache.set(k, pr);
  pr.then(u => { if (!u && imgCache.get(k) === pr) imgCache.delete(k); });
  if (imgCache.size > 100) { const [k0, v0] = imgCache.entries().next().value; imgCache.delete(k0); v0.then(u => u && URL.revokeObjectURL(u)); }
  return pr;
}
async function driveImg(dir, p) {
  if (!dirIds.has(dir)) return null;
  await driveToken(true);
  let d = dlist.get(dir);
  if (!d || Date.now() - d.t > 60000) { d = { t: Date.now(), v: DriveSource.list(dir) }; dlist.set(dir, d); d.v.catch(() => dlist.delete(dir)); }
  const m = (await d.v).find(x => !x.folder && x.path === p);
  if (!m || +m.size > MAXI) return null;
  return cached('d:' + m.id + ':' + m.version, async () => new Blob([await (await dapi(`${G}/files/${m.id}?alt=media`)).blob()], { type: IMGT[ext(p)] }));
}
async function workspaceImg(p, from) {
  const f = S.files.get(p), ty = b => new Blob([b], { type: IMGT[ext(p)] });
  if (f && f.src.type === 'github') return f.src.size > MAXI ? null : cached('g:' + p + ':' + f.src.sha, async () => ty(await MD.ghBlob(f)));
  if (f && typeof f.content === 'string' && f.content) return cached('t:' + p + ':' + f.updated, async () => ty(f.content));
  const h = handles.get(p);
  if (h) { const file = await h.getFile(); return file.size > MAXI ? null : cached('l:' + p + ':' + file.lastModified + ':' + file.size, async () => ty(file)); }
  const cf = S.files.get(from);
  return cf && cf.src.type === 'drive' ? driveImg(dirOf(p), p) : null;
}
async function rawImg(u) {
  const url = new URL(u), e = ext(url.pathname);
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' || !IMGT[e]) return null;
  return cached('r:' + url.href, async () => {
    const r = await fetch(url.href, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok || +(r.headers.get('content-length') || 0) > MAXI) return null;
    const b = await r.blob();
    return b.size > MAXI ? null : new Blob([b], { type: IMGT[e] });
  });
}
async function imgUrl(from, ref) {
  try {
    ref = ref.trim();
    if (/^https:\/\/raw\.githubusercontent\.com\//i.test(ref)) return await rawImg(ref);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
    const rel = decodeURIComponent(ref.split(/[?#]/)[0]);
    if (!IMGT[ext(rel)]) return null;
    const root = rootOf(from), p = rel[0] === '/' ? joinP(root, rel.slice(1)) : joinP(dirOf(from), rel);
    if (!p || (root && p !== root && !p.startsWith(root + '/'))) return null;
    return await workspaceImg(p, from);
  } catch { return null; }
}
function imgMiss(im, ref) {
  const remote = /^(?:https?:)?\/\//i.test(ref), el = document.createElement(remote ? 'a' : 'span');
  el.className = 'img-miss';
  el.textContent = im.alt || base(ref.split(/[?#]/)[0]) || 'image';
  el.title = t(remote ? 'img.remote' : 'img.missing') + ': ' + ref;
  if (remote) { el.href = ref; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  im.replaceWith(el);
}
function hydrateImgs(root, from, gen) {
  $$('img[data-src]', root).forEach(im => {
    const ref = im.dataset.src;
    im.onerror = () => imgMiss(im, ref);
    imgUrl(from, ref).then(u => { if (gen !== imgGen || !im.isConnected) return; if (u) im.src = u; else imgMiss(im, ref); });
  });
}

async function clip(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch {}
  const x = document.createElement('textarea');
  x.value = s;
  x.readOnly = true;
  x.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(x);
  x.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  x.remove();
  return ok;
}
async function copyFile() {
  const f = cur();
  if (f) toast(await clip(f.content) ? t('msg.copied', { n: base(f.path) }) : t('msg.err'));
}
function dupFile() {
  const f = cur();
  if (!f) return;
  const d = addFile(f.path, f.content, { type: 'draft' }, true);
  if (d) { openTab(d.path); toast(t('dup.done', { n: base(d.path) })); }
}
async function renameFile(p = S.active) {
  const f = S.files.get(p);
  if (!f) return;
  if (saving.has(p)) { toast(t('rn.busy')); return; }
  const o = base(p), v = prompt(t('rn.prompt'), o), n = v === null ? '' : v.trim();
  if (!n || n === o) return;
  if (n.length > 200 || /[\\/\0]/.test(n) || n === '.' || n === '..') { toast(t('rn.invalid')); return; }
  const np = p.slice(0, p.length - o.length) + n;
  if (S.files.has(np)) { toast(t('rn.exists')); return; }
  let note = '';
  try {
    if (f.src.type === 'drive' && f.src.id) {
      const m = await dmeta(f.src.id);
      if (m.version !== f.src.version || m.modifiedTime !== f.src.modifiedTime) { const e = new Error('conflict'); e.conflict = true; throw e; }
      const r = await dapi(`${G}/files/${f.src.id}?fields=${GF}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) });
      f.src = { ...f.src, ...stamp(await r.json()) };
    } else if (f.src.type === 'github') {
      if (f.src.state !== 'loaded') { toast(t('rn.gh')); return; }
      const rp = f.src.rpath, nr = rp.slice(0, rp.length - o.length) + n, from = f.src.from || rp;
      f.src = { ...f.src, rpath: nr };
      if (from === nr) delete f.src.from; else { f.src.from = from; f.dirty = true; }
    } else if (f.src.type === 'local' && handles.has(p)) {
      handles.delete(p);
      f.src = { type: 'draft' };
      f.dirty = true;
      note = t('rn.local');
    }
  } catch (e) { toast(errMsg(e)); return; }
  const had = timers.has(p);
  clearTimeout(timers.get(p));
  timers.delete(p);
  S.files.delete(p);
  f.path = np;
  f.updated = Date.now();
  S.files.set(np, f);
  if (paused.has(p)) { paused.set(np, paused.get(p)); paused.delete(p); }
  S.tabs = S.tabs.map(x => x === p ? np : x);
  if (S.active === p) S.active = np;
  DB.delMany([p]).catch(() => {});
  persist(f);
  saveUI();
  if (had || f.dirty) sched(f);
  renderAll();
  toast(note || t('rn.done', { n }));
}

function renderMd(src) {
  const { fm, body } = parseFM(src);
  const th = fm.theme === 'light' || fm.theme === 'dark' ? fm.theme : theme;
  const toc = fm.toc === 'true';
  pv.className = 'preview pv-' + th;
  doc.className = 'md layout-' + (fm.layout === 'wide' ? 'wide' : 'narrow') + (toc ? ' has-toc' : '');
  doc.innerHTML = DOMPurify.sanitize(marked.parse(body), SAN);
  hydrateImgs(doc, S.active || '', ++imgGen);
  $$('pre', doc).forEach(pre => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp';
    b.title = b.ariaLabel = t('act.copy');
    b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/assets/icons/sprite.svg#copy"/></svg>';
    pre.append(b);
  });
  const used = new Set(), hs = $$('h1,h2,h3,h4', doc);
  hs.forEach(h => {
    const s = 'md-' + (h.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'h');
    let u = s, n = 2;
    while (used.has(u)) u = s + '-' + n++;
    used.add(u);
    h.id = u;
  });
  if (toc && hs.length) {
    const nav = document.createElement('nav'), b = document.createElement('strong'), ul = document.createElement('ul');
    nav.className = 'toc';
    b.textContent = t('toc.title');
    hs.forEach(h => {
      const li = document.createElement('li'), a = document.createElement('a');
      li.className = 'l' + h.tagName[1];
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.append(a);
      ul.append(li);
    });
    nav.append(b, ul);
    doc.prepend(nav);
  }
}
function renderCode(src, path) {
  const l = LMAP[ext(path)] || ext(path);
  hlc.innerHTML = hlCode(src, l) + '\n';
  wrap.className = 'codewrap pv-' + theme;
}
function render() {
  const f = cur();
  if (!f) return;
  if (isMd(f.path)) { wrap.className = 'codewrap pv-' + theme; renderMd(f.content); } else renderCode(f.content, f.path);
}

function renderTabs() {
  tabsEl.replaceChildren(...S.tabs.map(p => {
    const f = S.files.get(p), d = document.createElement('div'), b = document.createElement('button'), x = document.createElement('button');
    d.className = 'tab' + (p === S.active ? ' on' : '') + (f.dirty ? ' dirty' : '');
    d.setAttribute('role', 'tab');
    d.setAttribute('aria-selected', p === S.active);
    b.type = x.type = 'button';
    b.className = 'tab-name';
    b.textContent = base(p);
    b.title = p;
    b.dataset.path = p;
    x.className = 'tab-x';
    x.textContent = '×';
    x.dataset.close = p;
    x.setAttribute('aria-label', t('tab.close') + ': ' + base(p));
    d.append(b, x);
    return d;
  }));
}
const dirState = new Map();
function renderTree() {
  const root = {};
  for (const p of [...S.files.keys()].sort()) {
    let n = root;
    const parts = p.split('/');
    parts.forEach((s, i) => { n = n[s] ??= i === parts.length - 1 ? p : {}; });
  }
  const build = (node, pre = '') => {
    const ul = document.createElement('ul');
    const keys = Object.keys(node).sort((a, b) => (typeof node[a] === 'string') - (typeof node[b] === 'string') || a.localeCompare(b));
    for (const k of keys) {
      const li = document.createElement('li'), v = node[k];
      if (typeof v === 'string') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'node' + (v === S.active ? ' on' : '') + (S.files.get(v).dirty ? ' dirty' : '') + (S.files.get(v).src.state === 'skipped' ? ' skip' : '');
        b.textContent = k;
        b.title = v;
        b.dataset.path = v;
        li.append(b);
      } else {
        const d = document.createElement('details'), s = document.createElement('summary'), np = pre ? pre + '/' + k : k;
        const lb = document.createElement('span'), rm = document.createElement('button');
        d.dataset.pre = np;
        d.open = dirState.has(np) ? dirState.get(np) : np.split('/').length < 4 || (S.active || '').startsWith(np + '/');
        lb.textContent = k;
        rm.type = 'button';
        rm.className = 'rm';
        rm.dataset.prefix = np;
        rm.title = rm.ariaLabel = t('rm.title');
        rm.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/assets/icons/sprite.svg#trash-2"/></svg>';
        s.append(lb, rm);
        d.append(s, build(v, np));
        li.append(d);
      }
      ul.append(li);
    }
    return ul;
  };
  if (Object.keys(root).length) tree.replaceChildren(build(root));
  else { const p = document.createElement('p'); p.className = 'empty-tree'; p.textContent = t('tree.empty'); tree.replaceChildren(p); }
}
function loadEditor() {
  const f = cur();
  if (window.MD && MD.stopRun) MD.stopRun();
  if (!f) { ta.value = ''; ta.disabled = true; app.dataset.kind = 'none'; doc.replaceChildren(); hlc.textContent = ''; syncState(); return; }
  const md = isMd(f.path);
  ta.disabled = false;
  ta.readOnly = !!f.ro;
  $('#btn-ro').setAttribute('aria-pressed', !!f.ro);
  ta.wrap = md ? 'soft' : 'off';
  ta.value = f.content;
  app.dataset.kind = md ? 'md' : 'code';
  render();
  syncState();
}
function renderAll() { renderTabs(); renderTree(); loadEditor(); if (window.MD && MD.afterRender) MD.afterRender(); }
async function openTab(p) {
  if (window.MD && MD.beforeOpen && await MD.beforeOpen(p) === false) return;
  if (!S.tabs.includes(p)) S.tabs.push(p);
  S.active = p;
  app.classList.remove('tree-open');
  saveUI();
  renderAll();
}
function removeFiles(paths) {
  const list = paths.filter(p => S.files.has(p));
  if (!list.length) return false;
  const dirty = list.filter(p => S.files.get(p).dirty).length;
  if (!confirm(t('rm.confirm', { n: list.length }) + (dirty ? '\n' + t('rm.dirty', { n: dirty }) : ''))) return false;
  list.forEach(p => { clearTimeout(timers.get(p)); timers.delete(p); paused.delete(p); handles.delete(p); S.files.delete(p); });
  S.tabs = S.tabs.filter(p => S.files.has(p));
  if (!S.files.has(S.active)) S.active = S.tabs[0] ?? null;
  DB.delMany(list).catch(() => {});
  saveUI();
  if (window.MD && MD.afterRemove) MD.afterRemove(list);
  renderAll();
  toast(t('rm.done', { n: list.length }));
  return true;
}
function closeTab(p) {
  const i = S.tabs.indexOf(p);
  if (i < 0) return;
  S.tabs.splice(i, 1);
  if (S.active === p) S.active = S.tabs[i] ?? S.tabs[i - 1] ?? null;
  saveUI();
  renderAll();
}

function applyI18n() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-label]').forEach(el => { const s = t(el.dataset.i18nLabel); el.setAttribute('aria-label', s); el.title = s; });
  $('#btn-lang').textContent = lang.toUpperCase();
}
function setTheme(th) {
  theme = th;
  document.documentElement.dataset.theme = th;
  LS.set('mdstudio-theme', th);
  render();
}
function setMode(m) {
  app.dataset.mode = m;
  LS.set('mdstudio-mode', m);
  $$('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
}

let tp, tr;
ta.addEventListener('input', () => {
  const f = cur();
  if (!f) return;
  f.content = ta.value;
  f.updated = Date.now();
  if (!f.dirty) { f.dirty = true; renderTabs(); renderTree(); }
  sched(f);
  syncState();
  clearTimeout(tp);
  tp = setTimeout(() => persist(f), 400);
  clearTimeout(tr);
  tr = setTimeout(render, 80);
});
ta.addEventListener('scroll', () => { const h = $('#hl'); h.scrollTop = ta.scrollTop; h.scrollLeft = ta.scrollLeft; });
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab' && app.dataset.kind === 'code' && !ta.readOnly && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input'));
  }
});
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); save(); } else if (k === 'o') { e.preventDefault(); openFiles(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'F2' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); renameFile(); }
});
tree.addEventListener('click', e => {
  const r = e.target.closest('.rm');
  if (r) { e.preventDefault(); e.stopPropagation(); removeFiles([...S.files.keys()].filter(p => p.startsWith(r.dataset.prefix + '/'))); return; }
  const sm = e.target.closest('summary');
  if (sm) { const d = sm.parentNode; setTimeout(() => dirState.set(d.dataset.pre, d.open), 0); return; }
  const b = e.target.closest('.node');
  if (b) openTab(b.dataset.path);
});
tabsEl.addEventListener('click', e => {
  const x = e.target.closest('[data-close]'), b = e.target.closest('.tab-name');
  if (x) closeTab(x.dataset.close); else if (b) openTab(b.dataset.path);
});
$('#modes').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
$('#btn-new').addEventListener('click', newFile);
$('#btn-rename').addEventListener('click', () => renameFile());
$('#btn-copy').addEventListener('click', copyFile);
$('#btn-dup').addEventListener('click', dupFile);
doc.addEventListener('click', async e => {
  const b = e.target.closest('.cp');
  if (!b) return;
  const c = b.parentNode.querySelector('code');
  toast(await clip(c ? c.textContent : '') ? t('copy.code') : t('msg.err'));
});
$('#btn-open').addEventListener('click', openFiles);
$('#btn-folder').addEventListener('click', openFolder);
$('#btn-save').addEventListener('click', () => save(cur(), false, true));
$('#btn-drive').addEventListener('click', openDrive);
$('#btn-todrive').addEventListener('click', () => save(cur(), true));
$('#btn-auto').addEventListener('click', () => {
  auto = !auto;
  LS.set('mdstudio-auto', auto ? '1' : '0');
  $('#btn-auto').setAttribute('aria-pressed', auto);
  if (auto) S.files.forEach(f => { if (f.dirty) sched(f, 0); }); else { timers.forEach(clearTimeout); timers.clear(); }
});
addEventListener('online', () => { if (auto) S.files.forEach(f => { if (f.dirty && f.src.type === 'drive') sched(f, 0); }); syncState(); });
addEventListener('offline', syncState);
document.addEventListener('visibilitychange', () => { if (document.hidden && auto) S.files.forEach(f => { if (f.dirty && f.src.type === 'drive') autoDrive(f); }); });
$('#btn-ro').addEventListener('click', () => {
  const f = cur();
  if (!f) return;
  f.ro = !f.ro;
  ta.readOnly = f.ro;
  $('#btn-ro').setAttribute('aria-pressed', f.ro);
  persist(f);
});
$('#btn-glogout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'mdstudio' } }).catch(() => {});
  tok = null;
  dwrap.hidden = true;
});
$('#btn-theme').addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'));
$('#btn-lang').addEventListener('click', () => { lang = lang === 'en' ? 'id' : 'en'; LS.set('mdstudio-lang', lang); applyI18n(); renderAll(); });
$('#btn-tree').addEventListener('click', () => app.classList.toggle('tree-open'));
new MutationObserver(() => $('#btn-tree').setAttribute('aria-expanded', app.classList.contains('tree-open'))).observe(app, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', e => { if (e.key === 'Escape') app.classList.remove('tree-open'); });
$('.work').addEventListener('click', () => app.classList.remove('tree-open'));
$('.welcome').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'gh') { app.classList.add('tree-open'); $('#gh-url').focus(); } else $('#btn-' + b.dataset.act).click();
});
$('#file-in').addEventListener('change', e => { const l = [...e.target.files]; e.target.value = ''; onPicked(l); });
if (!window.showDirectoryPicker) $('#btn-folder').hidden = true;

const SAMPLE = [
  '---', 'layout: narrow', 'toc: true', '---', '',
  '# mdstudio', '',
  'Front matter keys per file: `layout` (narrow|wide), `theme` (dark|light), `toc` (true|false).', '',
  '## Features', '',
  '* [x] Live preview', '* [x] Sanitized HTML', '* [ ] Drive and GitHub sources', '',
  '## Code', '',
  '```js', 'const sum = (a, b) => a + b;', '```', '',
  '| key | values |', '| --- | --- |', '| layout | narrow, wide |', '| toc | true, false |', ''
].join('\n');

window.MD = { S, t, toast, persist, DB, openTab, renderAll, cur, remove: removeFiles, BIN, MAXB, errMsg, drive: { DriveSource, dapi, driveToken, G, FOLDER } };
MD.ready = (async function init() {
  applyI18n();
  $('#btn-auto').setAttribute('aria-pressed', auto);
  document.documentElement.dataset.theme = theme;
  setMode(['editor', 'split', 'preview'].includes(LS.get('mdstudio-mode', 'split')) ? LS.get('mdstudio-mode', 'split') : 'split');
  let files = [], ui;
  try { files = await DB.all(); ui = await DB.getMeta('ui'); } catch {}
  files.forEach(f => { S.files.set(f.path, f); if (f.src && f.src.handle) handles.set(f.path, f.src.handle); });
  if (!S.files.size) {
    const f = addFile('welcome.md', SAMPLE, { type: 'draft' }, true);
    S.tabs = [f.path];
    S.active = f.path;
  } else {
    S.tabs = ((ui && ui.tabs) || []).filter(p => S.files.has(p));
    S.active = ui && S.files.has(ui.active) ? ui.active : S.tabs[0] ?? null;
    S.active ??= [...S.files.keys()][0];
    if (!S.tabs.includes(S.active)) S.tabs.push(S.active);
  }
  renderAll();
})();
})();
