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
async function save(f = cur()) {
  if (!f) return;
  try {
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
  } catch (e) { if (e.name !== 'AbortError') toast(t('msg.err')); }
}
function newFile() {
  const n = prompt(t('prompt.name'), 'untitled.md');
  if (!n) return;
  const p = n.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || /(^|\/)\.\.?(\/|$)/.test(p)) return;
  openTab(addFile(p, '', { type: 'draft' }, true).path);
  ta.focus();
}

const app = $('#app'), ta = $('#ta'), hlc = $('#hl code'), wrap = $('#wrap'), pv = $('#pv'), doc = $('#doc'), tree = $('#tree'), tabsEl = $('#tabs'), status = $('#status');
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

function renderMd(src) {
  const { fm, body } = parseFM(src);
  const th = fm.theme === 'light' || fm.theme === 'dark' ? fm.theme : theme;
  const toc = fm.toc === 'true';
  pv.className = 'preview pv-' + th;
  doc.className = 'md layout-' + (fm.layout === 'wide' ? 'wide' : 'narrow') + (toc ? ' has-toc' : '');
  doc.innerHTML = DOMPurify.sanitize(marked.parse(body), SAN);
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
function renderTree() {
  const root = {};
  for (const p of [...S.files.keys()].sort()) {
    let n = root;
    const parts = p.split('/');
    parts.forEach((s, i) => { n = n[s] ??= i === parts.length - 1 ? p : {}; });
  }
  const build = node => {
    const ul = document.createElement('ul');
    const keys = Object.keys(node).sort((a, b) => (typeof node[a] === 'string') - (typeof node[b] === 'string') || a.localeCompare(b));
    for (const k of keys) {
      const li = document.createElement('li'), v = node[k];
      if (typeof v === 'string') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'node' + (v === S.active ? ' on' : '') + (S.files.get(v).dirty ? ' dirty' : '');
        b.textContent = k;
        b.title = v;
        b.dataset.path = v;
        li.append(b);
      } else {
        const d = document.createElement('details'), s = document.createElement('summary');
        d.open = true;
        s.textContent = k;
        d.append(s, build(v));
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
  if (!f) { ta.value = ''; ta.disabled = true; app.dataset.kind = 'none'; doc.replaceChildren(); hlc.textContent = ''; return; }
  const md = isMd(f.path);
  ta.disabled = false;
  ta.wrap = md ? 'soft' : 'off';
  ta.value = f.content;
  app.dataset.kind = md ? 'md' : 'code';
  render();
}
function renderAll() { renderTabs(); renderTree(); loadEditor(); }
function openTab(p) {
  if (!S.tabs.includes(p)) S.tabs.push(p);
  S.active = p;
  app.classList.remove('tree-open');
  saveUI();
  renderAll();
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
  clearTimeout(tp);
  tp = setTimeout(() => persist(f), 400);
  clearTimeout(tr);
  tr = setTimeout(render, 80);
});
ta.addEventListener('scroll', () => { const h = $('#hl'); h.scrollTop = ta.scrollTop; h.scrollLeft = ta.scrollLeft; });
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab' && app.dataset.kind === 'code' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
tree.addEventListener('click', e => { const b = e.target.closest('.node'); if (b) openTab(b.dataset.path); });
tabsEl.addEventListener('click', e => {
  const x = e.target.closest('[data-close]'), b = e.target.closest('.tab-name');
  if (x) closeTab(x.dataset.close); else if (b) openTab(b.dataset.path);
});
$('#modes').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
$('#btn-new').addEventListener('click', newFile);
$('#btn-open').addEventListener('click', openFiles);
$('#btn-folder').addEventListener('click', openFolder);
$('#btn-save').addEventListener('click', () => save());
$('#btn-theme').addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'));
$('#btn-lang').addEventListener('click', () => { lang = lang === 'en' ? 'id' : 'en'; LS.set('mdstudio-lang', lang); applyI18n(); renderAll(); });
$('#btn-tree').addEventListener('click', () => app.classList.toggle('tree-open'));
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

(async function init() {
  applyI18n();
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
