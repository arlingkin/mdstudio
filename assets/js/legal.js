(() => {
'use strict';
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
let lang = LS.get('mdstudio-lang', /^id/i.test(navigator.language) ? 'id' : 'en') === 'id' ? 'id' : 'en';
let theme = LS.get('mdstudio-theme', 'dark') === 'light' ? 'light' : 'dark';
const bl = document.getElementById('btn-lang');
const bt = document.getElementById('btn-theme');
const apply = () => {
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
  bl.textContent = lang.toUpperCase();
  bt.textContent = lang === 'id' ? 'tema' : 'theme';
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
apply();
})();
