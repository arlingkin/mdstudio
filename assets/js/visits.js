'use strict';
// Unique-device visitor counter. Hash uses traits that stay the same across browsers/WebViews on one device.
(() => {
  const box = document.getElementById('visits'), out = document.getElementById('visits-n');
  if (!box || !out) return;
  const KEY = 'mdstudio-visits';
  const show = n => { out.textContent = Number(n).toLocaleString(); box.hidden = false; };
  try { const v = parseInt(localStorage.getItem(KEY), 10); if (v > 0) show(v); } catch {}
  const os = () => {
    const u = navigator.userAgent;
    return /Android/i.test(u) ? 'android' : /iPhone|iPad|iPod/i.test(u) ? 'ios' : /Windows/i.test(u) ? 'windows'
      : /Mac/i.test(u) ? (navigator.maxTouchPoints > 1 ? 'ios' : 'mac') : /CrOS/i.test(u) ? 'cros' : /Linux/i.test(u) ? 'linux' : 'other';
  };
  const sig = () => {
    const d = window.devicePixelRatio || 1, w = Math.round(screen.width * d), h = Math.round(screen.height * d);
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    return [os(), Math.max(w, h), Math.min(w, h), navigator.hardwareConcurrency || 0, Math.min(navigator.maxTouchPoints || 0, 5),
      screen.colorDepth || 0, tz, (navigator.language || '').slice(0, 2).toLowerCase()].join('|');
  };
  const hash = async s => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mdstudio|' + s));
    return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
  };
  (async () => {
    try {
      if (!navigator.onLine || !(window.crypto && crypto.subtle)) return;
      const r = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mdstudio' },
        body: JSON.stringify({ h: await hash(sig()) })
      });
      if (!r.ok) return;
      const n = (await r.json()).count;
      if (!(n > 0)) return;
      show(n);
      try { localStorage.setItem(KEY, String(n)); } catch {}
    } catch {}
  })();
})();
