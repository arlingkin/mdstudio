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
bl.addEventListener('click', () => { lang = lang === 'en' ? 'id' : 'en'; LS.set('mdstudio-lang', lang); apply(); });
bt.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; LS.set('mdstudio-theme', theme); apply(); });
apply();
})();
