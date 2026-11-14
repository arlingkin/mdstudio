const c = require('node:crypto');
const a = require('./_auth');
const K = 'visitors:v1';
const cfg = () => {
  const e = process.env;
  const url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL, token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  const salt = e.VISIT_SALT || e.COOKIE_KEY;
  if (!url || !token || !salt) throw Object.assign(new Error('config'), { code: 'config' });
  return { url: url.replace(/\/$/, ''), token, salt };
};
// Counts unique devices: client sends a SHA-256 of coarse device traits; we store only a salted HMAC of it.
module.exports = async (req, res) => {
  if (!a.post(req, res)) return;
  try {
    const h = req.body && typeof req.body.h === 'string' ? req.body.h : '';
    if (!/^[0-9a-f]{64}$/.test(h)) return a.send(res, 400, { error: 'input' });
    const { url, token, salt } = cfg();
    const id = c.createHmac('sha256', salt).update('visit:' + h).digest('hex');
    const r = await fetch(url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SADD', K, id], ['SCARD', K]])
    });
    if (!r.ok) return a.send(res, 502, { error: 'upstream' });
    const j = await r.json();
    const n = Number(j && j[1] && j[1].result);
    if (!Number.isFinite(n)) return a.send(res, 502, { error: 'upstream' });
    a.send(res, 200, { count: n });
  } catch (e) { a.fail(res, e); }
};
