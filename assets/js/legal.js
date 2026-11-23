(() => {
'use strict';
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
let lang = LS.get('mdstudio-lang', /^id/i.test(navigator.language) ? 'id' : 'en') === 'id' ? 'id' : 'en';
let theme = LS.get('mdstudio-theme', 'dark') === 'light' ? 'light' : 'dark';
const ACCENTS = ['lime', 'blue', 'pink', 'amber', 'violet'];
const readAccent = () => { const a = LS.get('mdstudio-accent', 'lime'); return ACCENTS.includes(a) ? a : 'lime'; };
let accent = readAccent();
const bl = document.getElementById('btn-lang');
const bt = document.getElementById('btn-theme');
const bls = bl.querySelector('span'), bts = bt.querySelector('span');
const apply = () => {
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  bls.textContent = lang.toUpperCase();
  bts.textContent = lang === 'id' ? 'tema' : 'theme';
  bl.title = lang === 'id' ? 'Bahasa' : 'Language';
  bt.title = bts.textContent;
  document.title = document.documentElement.dataset[lang === 'id' ? 'titleId' : 'titleEn'];
};
document.querySelectorAll('.legal-in > [data-l]').forEach(box => {
  const hs = [...box.querySelectorAll('h2')], meta = box.querySelector('.meta');
  if (!meta || hs.length < 3) return;
  const nav = document.createElement('nav');
  nav.className = 'l-toc';
  hs.forEach((h, i) => { h.id = 'l-' + box.dataset.l + '-' + i; const a = document.createElement('a'); a.href = '#' + h.id; a.textContent = h.textContent; nav.append(a); });
  meta.after(nav);
});
bl.addEventListener('click', () => { lang = lang === 'en' ? 'id' : 'en'; LS.set('mdstudio-lang', lang); apply(); });
bt.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; LS.set('mdstudio-theme', theme); apply(); });
const sync = () => { theme = LS.get('mdstudio-theme', 'dark') === 'light' ? 'light' : 'dark'; accent = readAccent(); apply(); };
addEventListener('storage', e => { if (!e.key || e.key === 'mdstudio-theme' || e.key === 'mdstudio-accent') sync(); });
addEventListener('pageshow', e => { if (e.persisted) sync(); });
apply();
})();
