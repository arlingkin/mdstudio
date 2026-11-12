(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const app = $('#app'), ta = $('#ta'), pv = $('#pv'), panes = $('.panes'), body = document.body;
const mq = matchMedia('(max-width: 800px)');
const t = (k, v) => window.MD ? MD.t(k, v) : k;
const mdOn = () => app.dataset.kind === 'md' && !ta.readOnly && !ta.disabled;

/* tooltips for labelled buttons */
function titles() {
  $$('.bar .btn, .tabbar .btn, .side .btn, .tools .btn').forEach(b => {
    if (b.dataset.i18nLabel) return;
    const s = $('span[data-i18n]', b);
    if (s) b.title = s.textContent;
  });
}

/* sidebar (desktop) */
const sideBtn = $('#btn-side');
function setSide(on) {
  app.classList.toggle('side-off', !on);
  sideBtn.setAttribute('aria-pressed', on);
  LS.set('mdstudio-side', on ? '1' : '0');
}
sideBtn.addEventListener('click', () => setSide(app.classList.contains('side-off')));
setSide(LS.get('mdstudio-side', '1') !== '0');

/* mobile: actions sheet + bottom nav */
const more = $('#btn-more');
const sheet = on => { document.body.classList.toggle('sheet', on); more.setAttribute('aria-expanded', on); };
more.addEventListener('click', e => { e.stopPropagation(); sheet(!body.classList.contains('sheet')); });
$('#actions').addEventListener('click', e => { if (e.target.closest('.btn')) setTimeout(() => sheet(false), 0); });
document.addEventListener('click', e => { if (body.classList.contains('sheet') && !e.target.closest('#actions')) sheet(false); });
app.addEventListener('click', e => { if (e.target === app) app.classList.remove('tree-open'); });
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  app.classList.remove('tree-open');
  $('#modes [data-mode="' + b.dataset.go + '"]').click();
}));
const syncNav = () => $$('[data-go]').forEach(b => b.setAttribute('aria-pressed', app.dataset.mode === b.dataset.go));
new MutationObserver(syncNav).observe(app, { attributes: true, attributeFilter: ['data-mode'] });

/* draggable divider */
const gut = $('#gutter');
let ed = parseFloat(LS.get('mdstudio-ed', '50')) || 50;
const setEd = p => { ed = Math.min(80, Math.max(20, p)); panes.style.setProperty('--ed', ed + '%'); LS.set('mdstudio-ed', String(ed)); };
setEd(ed);
gut.addEventListener('pointerdown', e => { gut.setPointerCapture(e.pointerId); gut.classList.add('drag'); panes.classList.add('dragging'); });
gut.addEventListener('pointermove', e => {
  if (!gut.classList.contains('drag')) return;
  const r = panes.getBoundingClientRect();
  setEd((e.clientX - r.left) / r.width * 100);
});
const endDrag = () => { gut.classList.remove('drag'); panes.classList.remove('dragging'); };
gut.addEventListener('pointerup', endDrag);
gut.addEventListener('pointercancel', endDrag);
gut.addEventListener('dblclick', () => setEd(50));
gut.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') setEd(ed - 2); else if (e.key === 'ArrowRight') setEd(ed + 2); else if (e.key === 'Home') setEd(50);
});
ta.addEventListener('scroll', () => {
  if (app.dataset.mode !== 'split' || app.dataset.kind !== 'md') return;
  pv.scrollTop = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight) * (pv.scrollHeight - pv.clientHeight);
});

/* formatting */
function ins(text, a, b) {
  ta.focus();
  ta.setSelectionRange(a, b);
  if (!document.execCommand('insertText', false, text)) {
    ta.setRangeText(text, a, b, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
function wrap(l, r, ph) {
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  if (s !== e && v.slice(s - l.length, s) === l && v.slice(e, e + r.length) === r) {
    const sel = v.slice(s, e);
    ins(sel, s - l.length, e + r.length);
    ta.setSelectionRange(s - l.length, s - l.length + sel.length);
    return;
  }
  const sel = v.slice(s, e) || ph;
  ins(l + sel + r, s, e);
  ta.setSelectionRange(s + l.length, s + l.length + sel.length);
}
function prefix(make, re) {
  const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  const a = v.lastIndexOf('\n', s - 1) + 1;
  let b = v.indexOf('\n', e);
  if (b < 0) b = v.length;
  const lines = v.slice(a, b).split('\n');
  const all = lines.every(l => re.test(l));
  const out = lines.map((l, i) => all ? l.replace(re, '') : make(i) + l.replace(re, '')).join('\n');
  ins(out, a, b);
  ta.setSelectionRange(a, a + out.length);
}
function heading() {
  const v = ta.value, s = ta.selectionStart, a = v.lastIndexOf('\n', s - 1) + 1;
  let b = v.indexOf('\n', s);
  if (b < 0) b = v.length;
  const line = v.slice(a, b), m = /^(#{1,6}) /.exec(line), n = m ? m[1].length : 1;
  const out = (n >= 4 ? '' : '#'.repeat(n + 1) + ' ') + line.replace(/^#{1,6} /, '');
  ins(out, a, b);
  ta.setSelectionRange(a + out.length, a + out.length);
}
function block(text, cursor) {
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  const nl = s > 0 && v[s - 1] !== '\n' ? '\n' : '';
  ins(nl + text, s, e);
  if (cursor != null) ta.setSelectionRange(s + nl.length + cursor[0], s + nl.length + cursor[1]);
}
const FMT = {
  bold: () => wrap('**', '**', 'bold'),
  italic: () => wrap('*', '*', 'italic'),
  strike: () => wrap('~~', '~~', 'text'),
  code: () => wrap('`', '`', 'code'),
  heading,
  quote: () => prefix(() => '> ', /^> /),
  ul: () => prefix(() => '- ', /^[-*+] (?!\[[ xX]\] )/),
  ol: () => prefix(i => (i + 1) + '. ', /^\d+\. /),
  task: () => prefix(() => '- [ ] ', /^- \[[ xX]\] /),
  link: () => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || 'text';
    ins('[' + sel + '](url)', s, e);
    ta.setSelectionRange(s + sel.length + 3, s + sel.length + 6);
  },
  table: () => block('| Column | Column |\n| --- | --- |\n|  |  |\n'),
  block: () => { const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); block('```\n' + sel + '\n```\n', [4, 4 + sel.length]); },
  hr: () => block('\n---\n\n')
};
const fmt = $('#fmt');
fmt.addEventListener('mousedown', e => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
fmt.addEventListener('click', e => {
  const b = e.target.closest('[data-fmt]');
  if (b && mdOn()) FMT[b.dataset.fmt]();
});
ta.addEventListener('keydown', e => {
  if (!mdOn() || e.isComposing) return;
  const m = e.ctrlKey || e.metaKey;
  if (m && !e.altKey && !e.shiftKey) {
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); FMT.bold(); } else if (k === 'i') { e.preventDefault(); FMT.italic(); }
    return;
  }
  if (e.key !== 'Enter' || e.shiftKey || m || e.altKey || ta.selectionStart !== ta.selectionEnd) return;
  const v = ta.value, s = ta.selectionStart, a = v.lastIndexOf('\n', s - 1) + 1;
  const mm = /^(\s*)([-*+]|\d+\.)( \[[ xX]\])? (.*)$/.exec(v.slice(a, s));
  if (!mm) return;
  e.preventDefault();
  if (mm[4] === '') { ins('', a, s); return; }
  const mark = /\d/.test(mm[2]) ? (parseInt(mm[2], 10) + 1) + '.' : mm[2];
  ins('\n' + mm[1] + mark + (mm[3] ? ' [ ]' : '') + ' ', s, s);
});

/* status bar */
const sb = $('#sbar'), sbFile = $('#sb-file'), sbWords = $('#sb-words'), sbRead = $('#sb-read'), sbPos = $('#sb-pos'), sbIcon = $('.sb-file use'), sbChars = $('#sb-chars'), sbLines = $('#sb-lines'), sbEl = $('#sb-el'), docEl = $('#doc');
const nf = n => Number(n).toLocaleString();
const nlines = v => { let n = 1; for (let i = v.indexOf('\n'); i >= 0; i = v.indexOf('\n', i + 1)) n++; return n; };
let raf = 0;
function ghActive(f) {
  if (!f) return false;
  if (f.src && f.src.type === 'github') return true;
  const root = f.path.split('/')[0] + '/';
  return !!(MD.S && MD.S.files) && [...MD.S.files.values()].some(x => x.src && x.src.type === 'github' && x.path.startsWith(root));
}
function upd() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const f = window.MD && MD.cur();
    ['btn-save', 'btn-todrive', 'btn-ro'].forEach(id => { $('#' + id).disabled = !f; });
    const gh = ghActive(f);
    $('#gh-run').disabled = !(gh && MD.hasIndex && MD.hasIndex(f));
    ['gh-commit', 'gh-todrive'].forEach(id => { $('#' + id).disabled = !gh; });
    sb.hidden = !f;
    if (!f) return;
    const v = ta.value, w = (v.match(/\S+/g) || []).length, type = f.src && f.src.type;
    sbFile.textContent = f.path + (f.dirty ? ' ●' : '');
    sbIcon.setAttribute('href', '/assets/icons/sprite.svg#' + (type === 'drive' ? 'google-drive' : type === 'github' ? 'github' : 'hard-drive'));
    sbWords.textContent = t('sb.words', { n: nf(w) });
    sbChars.textContent = t('sb.chars', { n: nf(v.length) });
    sbLines.textContent = t('sb.lines', { n: nf(nlines(v)) });
    const md = app.dataset.kind === 'md';
    sbEl.hidden = !md;
    if (md) sbEl.textContent = t('sb.el', { n: nf(docEl.querySelectorAll('*').length) });
    sbRead.textContent = t('sb.read', { n: Math.max(1, Math.ceil(w / 200)) });
    const s = ta.selectionStart, e = ta.selectionEnd, before = v.slice(0, s);
    sbPos.textContent = t('sb.pos', { l: before.split('\n').length, c: s - before.lastIndexOf('\n') }) + (e > s ? ' · ' + t('sb.sel', { n: nf(e - s) }) : '');
    renderInfo();
  });
}
['input', 'keyup', 'click', 'select', 'focus'].forEach(ev => ta.addEventListener(ev, upd));
document.addEventListener('selectionchange', () => { if (document.activeElement === ta) upd(); });
[['#tree', { childList: true }], ['#tabs', { childList: true, subtree: true, attributes: true }], ['#doc', { childList: true }], ['#sync', { childList: true }]]
  .forEach(([sel, o]) => new MutationObserver(upd).observe($(sel), o));

/* document + workspace details */
const info = $('#info'), infoBtn = $('#sb-info');
const bytes = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
function section(title, rows) {
  const h = document.createElement('h3'), dl = document.createElement('dl');
  h.textContent = title;
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = t(k); dd.textContent = v;
    dl.append(dt, dd);
  });
  return [h, dl];
}
function renderInfo() {
  if (info.hidden || !window.MD) return;
  const f = MD.cur(), out = [];
  if (f) {
    const v = ta.value;
    let chars = 0, nospace = 0, letters = 0, digits = 0;
    for (const ch of v) {
      chars++;
      if (/\s/.test(ch)) continue;
      nospace++;
      if (/\p{L}/u.test(ch)) letters++; else if (/\p{N}/u.test(ch)) digits++;
    }
    const w = (v.match(/\S+/g) || []).length;
    out.push(...section(t('info.doc'), [['k.words', nf(w)], ['k.chars', nf(chars)], ['k.nospace', nf(nospace)], ['k.letters', nf(letters)], ['k.digits', nf(digits)],
      ['k.lines', nf(nlines(v))], ['k.paras', nf(v.split(/\n\s*\n/).filter(x => x.trim()).length)], ['k.size', bytes(new Blob([v]).size)], ['k.read', t('k.min', { n: Math.max(1, Math.ceil(w / 200)) })]]));
    if (app.dataset.kind === 'md') {
      const q = sel => [...docEl.querySelectorAll(sel)].filter(e => !e.closest('.toc')).length;
      const boxes = [...docEl.querySelectorAll('input[type=checkbox]')];
      out.push(...section(t('info.el'), [['k.elements', nf(docEl.querySelectorAll('*').length)], ['k.headings', nf(q('h1,h2,h3,h4,h5,h6'))], ['k.links', nf(q('a[href]'))],
        ['k.images', nf(q('img'))], ['k.items', nf(q('li'))], ['k.blocks', nf(q('pre'))], ['k.tables', nf(q('table'))], ['k.quotes', nf(q('blockquote'))],
        ['k.tasks', boxes.filter(b => b.checked).length + ' / ' + boxes.length]]));
    }
  }
  const files = [...MD.S.files.values()], loaded = files.filter(x => x.src && x.src.state !== 'remote' && x.src.state !== 'skipped');
  const total = loaded.reduce((a, x) => a + (x.content || '').length, 0);
  const words = total < 3e6 ? nf(loaded.reduce((a, x) => a + ((x.content || '').match(/\S+/g) || []).length, 0)) : '—';
  const ty = x => x.src && x.src.type;
  out.push(...section(t('info.ws'), [['k.files', nf(files.length)], ['k.device', nf(files.filter(x => ty(x) !== 'drive' && ty(x) !== 'github').length)],
    ['k.drive', nf(files.filter(x => ty(x) === 'drive').length)], ['k.gh', nf(files.filter(x => ty(x) === 'github').length)],
    ['k.wchars', nf(total)], ['k.wwords', words], ['k.unsaved', nf(files.filter(x => x.dirty).length)]]));
  info.replaceChildren(...out);
}
function toggleInfo(on = info.hidden) {
  info.hidden = !on;
  infoBtn.setAttribute('aria-expanded', on);
  renderInfo();
}
infoBtn.addEventListener('click', e => { e.stopPropagation(); toggleInfo(); });
document.addEventListener('click', e => { if (!info.hidden && !e.target.closest('#info')) toggleInfo(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !info.hidden) toggleInfo(false); });

/* command palette */
const pal = $('#palette'), pin = $('#pal-in'), plist = $('#pal-list');
let items = [], sel = 0, lastFocus = null;
const click = id => () => $('#' + id).click();
const showSide = () => { if (app.classList.contains('side-off')) setSide(true); app.classList.add('tree-open'); };
function commands() {
  const c = [], f = MD.cur();
  const add = (icon, label, run, key, scope) => c.push({ icon, label: scope ? scope + ' · ' + label : label, run, key });
  const dev = t('sc.device'), drv = 'Drive', gh = 'GitHub';
  add('file-plus', t('act.new'), click('btn-new'), '', dev);
  add('file-text', t('act.open'), click('btn-open'), 'Ctrl+O', dev);
  if (!$('#btn-folder').hidden) add('folder-open', t('act.folder'), click('btn-folder'), '', dev);
  if (f) add('save', t('act.todevice'), click('btn-save'), '', dev);
  add('google-drive', t('w.drive.go'), click('btn-drive'), '', drv);
  if (f) add('cloud-upload', t('act.todrive'), click('btn-todrive'), '', drv);
  add('refresh-cw', t('act.auto'), click('btn-auto'), '', drv);
  if (f && f.src.type === 'drive' && f.src.id) add('trash-2', t('act.ddel'), click('btn-ddel'), '', drv);
  add('github', t('gh.go'), () => { showSide(); $('#gh-url').focus(); }, '', gh);
  if (ghActive(f)) {
    add('play', t('gh.run'), click('gh-run'), '', gh);
    add('git-commit-horizontal', t('gh.commit'), click('gh-commit'), '', gh);
    add('cloud-upload', t('gh.todrive'), click('gh-todrive'), '', gh);
  }
  add('info', t('p.info'), () => toggleInfo(true));
  if (f) add('trash-2', t('rm.file'), () => MD.remove([f.path]), '', t('info.ws'));
  if (f) { add('pencil', t('act.rename'), click('btn-rename'), 'F2', t('sc.file')); add('copy', t('act.copy'), click('btn-copy'), '', t('sc.file')); add('copy-plus', t('act.dup'), click('btn-dup'), '', t('sc.file')); }
  if (f) {
    add('save', t('act.save'), () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })), 'Ctrl+S');
    if (app.dataset.mode !== 'preview') add('lock', t('act.ro'), click('btn-ro'));
  }
  add('pencil', t('mode.editor'), () => $('#modes [data-mode="editor"]').click());
  add('columns-2', t('mode.split'), () => $('#modes [data-mode="split"]').click());
  add('eye', t('mode.preview'), () => $('#modes [data-mode="preview"]').click());
  add('sun-moon', t('act.theme'), click('btn-theme'));
  add('languages', t('act.lang'), click('btn-lang'));
  if (!mq.matches) {
    add('panel-left', t('p.side'), () => setSide(app.classList.contains('side-off')), 'Ctrl+\\');
    add('maximize', t('p.focus'), toggleFocus, 'Ctrl+Shift+F');
  }
  add('book-open', t('p.guide'), () => { location.href = '/guide'; });
  add('shield-check', t('w.privacy'), () => { location.href = '/privacy'; });
  add('file-text', t('w.terms'), () => { location.href = '/terms'; });
  if (mdOn() && app.dataset.mode !== 'preview') {
    [['bold', 'bold', 'Ctrl+B'], ['italic', 'italic', 'Ctrl+I'], ['strike', 'strikethrough'], ['code', 'code'], ['heading', 'heading'], ['quote', 'quote'],
     ['ul', 'list'], ['ol', 'list-ordered'], ['task', 'list-checks'], ['link', 'link'], ['table', 'table'], ['block', 'file-code'], ['hr', 'minus']]
      .forEach(([k, icon, key]) => add(icon, t('f.' + k), FMT[k], key));
  }
  return c;
}
function draw() {
  plist.replaceChildren();
  if (!items.length) { const p = document.createElement('li'); p.className = 'pal-none'; p.textContent = t('p.none'); plist.append(p); return; }
  items.forEach((it, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'pal-item'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', i === sel);
    b.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/assets/icons/sprite.svg#' + it.icon + '"/></svg>';
    const s = document.createElement('span'); s.textContent = it.label; b.append(s);
    if (it.key) { const k = document.createElement('kbd'); k.textContent = it.key; b.append(k); }
    b.addEventListener('click', () => run(i));
    li.append(b); plist.append(li);
  });
  const on = $('[aria-selected="true"]', plist);
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function filter() {
  const q = pin.value.trim().toLowerCase();
  items = all.filter(i => i.label.toLowerCase().includes(q));
  sel = 0;
  draw();
}
let all = [];
function openPal() {
  if (!window.MD) return;
  lastFocus = document.activeElement;
  all = commands();
  pin.value = '';
  pal.hidden = false;
  filter();
  // Touch: skip focus so the keyboard stays hidden; tapping the field opens it.
  if (matchMedia('(hover: none) and (pointer: coarse)').matches) pal.querySelector('.pal-box').tabIndex = -1, pal.querySelector('.pal-box').focus({ preventScroll: true });
  else pin.focus();
}
function closePal() {
  pal.hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function run(i) {
  const it = items[i];
  if (!it) return;
  closePal();
  setTimeout(it.run, 0);
}
pin.addEventListener('input', filter);
pin.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
  else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
});
pal.addEventListener('mousedown', e => { if (e.target === pal) closePal(); });
$('#btn-palette').addEventListener('click', openPal);

/* focus mode (desktop) */
function toggleFocus() {
  const on = !body.classList.contains('focus');
  body.classList.toggle('focus', on);
  if (on) MD.toast(t('p.focushint'));
}

/* global shortcuts */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!pal.hidden) { closePal(); return; }
    body.classList.remove('focus');
    sheet(false);
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'k' && !e.shiftKey) { e.preventDefault(); if (pal.hidden) openPal(); else closePal(); }
  else if (k === '\\' && !mq.matches) { e.preventDefault(); setSide(app.classList.contains('side-off')); }
  else if (k === 'f' && e.shiftKey && !mq.matches) { e.preventDefault(); toggleFocus(); }
});

$('#btn-auto').addEventListener('click', () => MD.toast(t('msg.autonote')));
$('#btn-lang').addEventListener('click', () => setTimeout(() => { titles(); upd(); }, 0));
(window.MD ? MD.ready : Promise.resolve()).then(() => { titles(); syncNav(); upd(); });
})();
