// BENJI OS — multi-device sync. Stores the Keys/config bundle in Netlify Blobs under a user sync code.
// NOT end-to-end encrypted: anyone with your sync code could read it, so use a long, private code.
import { getStore } from '@netlify/blobs';
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  let store;
  try { store = getStore('benji-sync'); } catch (e) { return json({ error: 'blob store unavailable: ' + e.message }, 500); }
  const u = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const code = u.searchParams.get('code') || '';
      if (code.length < 6) return json({ error: 'sync code must be 6+ chars' }, 400);
      const raw = await store.get('k_' + code);
      const parsed = raw ? JSON.parse(raw) : null;
      return json({ ok: true, data: parsed ? (parsed.bundle || parsed) : null, updated: parsed && parsed.updated });
    }
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!b.code || b.code.length < 6) return json({ error: 'sync code must be 6+ chars' }, 400);
      await store.set('k_' + b.code, JSON.stringify({ bundle: b.data || {}, updated: Date.now() }));
      return json({ ok: true, updated: Date.now() });
    }
    return json({ error: 'method' }, 405);
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
};
export const config = { path: '/api/sync' };
