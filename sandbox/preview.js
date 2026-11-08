addEventListener('message', e => {
  if (e.source !== parent || !e.data || typeof e.data.html !== 'string') return;
  document.open();
  document.write(e.data.html);
  document.close();
}, { once: true });
