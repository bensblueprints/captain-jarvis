// BENJI OS — Shopify storefront funnel collector. The custom pixel POSTs events here; the dashboard GETs the aggregate.
import { getStore } from '@netlify/blobs';
function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' }; }
const EVMAP = { page_viewed: 'sessions', product_added_to_cart: 'atc', checkout_started: 'checkout', checkout_completed: 'conversion' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors() });
  let store; try { store = getStore('benji-pixel'); } catch (e) { return new Response(JSON.stringify({ error: 'blobs unavailable' }), { status: 500, headers: cors() }); }
  const today = () => new Date().toISOString().slice(0, 10);

  if (req.method === 'POST') {
    let b = {}; try { b = await req.json(); } catch {}
    const ev = EVMAP[b.event];
    if (!ev) return new Response(JSON.stringify({ ok: true, ignored: b.event }), { headers: cors() });
    const key = 'c_' + today();
    let rec = {}; try { rec = JSON.parse(await store.get(key)) || {}; } catch {}
    rec[ev] = (rec[ev] || 0) + 1;
    await store.set(key, JSON.stringify(rec));
    return new Response(JSON.stringify({ ok: true }), { headers: cors() });
  }

  // GET: aggregate the last N days
  const u = new URL(req.url);
  const days = Math.min(90, +(u.searchParams.get('days') || 30) || 30);
  const cutoff = Date.now() - days * 86400000;
  const agg = { sessions: 0, atc: 0, checkout: 0, conversion: 0 };
  try {
    const { blobs } = await store.list({ prefix: 'c_' });
    for (const bl of blobs) {
      const date = bl.key.slice(2); // after 'c_'
      if (new Date(date).getTime() < cutoff) continue;
      try { const r = JSON.parse(await store.get(bl.key)); for (const k of Object.keys(agg)) agg[k] += r[k] || 0; } catch {}
    }
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { headers: cors() }); }
  return new Response(JSON.stringify({ ok: true, days, funnel: agg }), { headers: cors() });
};
export const config = { path: '/api/pixel' };
