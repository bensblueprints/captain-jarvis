// BENJI OS — GoHighLevel: contacts + opportunities + conversations (read + light write)
// Keys tab header x-cfg-ghl {token, locationId}, or env GHL_TOKEN + GHL_LOCATION_ID
import { gate, json } from './_auth.mjs';

const API = 'https://services.leadconnectorhq.com';

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  let cfg = {}; try { cfg = JSON.parse(req.headers.get('x-cfg-ghl') || '{}'); } catch {}
  const token = cfg.token || process.env.GHL_TOKEN;
  const loc = cfg.locationId || process.env.GHL_LOCATION_ID;
  if (!token || !loc) return json({ error: 'not_configured' });
  const H = { Authorization: 'Bearer ' + token, Version: '2021-07-28', Accept: 'application/json' };
  const u = new URL(req.url);
  const act = u.searchParams.get('action') || 'contacts';
  const q = u.searchParams.get('q') || '';

  const getJSON = async (url, opts) => {
    const r = await fetch(url, opts || { headers: H });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d };
  };

  try {
    const mapC = c => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.contactName || c.name || c.email || c.phone || '',
      email: c.email || '', phone: c.phone || '', tags: c.tags || [], added: c.dateAdded
    });
    if (act === 'contacts') {
      // Default view: first page + the TOTAL count (works for 200k+ without pulling everything).
      const { ok, status, d } = await getJSON(`${API}/contacts/?locationId=${encodeURIComponent(loc)}&limit=50`);
      if (!ok) return json({ error: 'GHL ' + status + ' ' + (d.message || '') + ' — token needs contacts.readonly scope' });
      const total = (d.meta && (d.meta.total || d.meta.totalRecords)) || (d.contacts || []).length;
      return json({ total, contacts: (d.contacts || []).map(mapC) });
    }
    if (act === 'contact-search') {
      // Server-side text search across the whole base.
      const term = q.trim();
      if (!term) return json({ total: 0, contacts: [] });
      // 1) try the v2 advanced search (POST) which searches the full DB
      try {
        const sr = await fetch(`${API}/contacts/search`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: loc, page: 1, pageLimit: 50, query: term }) });
        const sd = await sr.json().catch(() => ({}));
        if (sr.ok && (sd.contacts || sd.results)) {
          const list = sd.contacts || sd.results || [];
          return json({ total: sd.total || list.length, contacts: list.map(mapC) });
        }
      } catch {}
      // 2) fallback: list endpoint with query param
      const { ok, status, d } = await getJSON(`${API}/contacts/?locationId=${encodeURIComponent(loc)}&limit=50&query=${encodeURIComponent(term)}`);
      if (!ok) return json({ error: 'GHL ' + status + ' ' + (d.message || '') });
      return json({ total: (d.meta && d.meta.total) || (d.contacts || []).length, contacts: (d.contacts || []).map(mapC) });
    }

    if (act === 'opportunities') {
      const pr = await getJSON(`${API}/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`);
      if (!pr.ok) return json({ error: 'GHL pipelines ' + pr.status + ' ' + (pr.d.message || '') });
      const pipes = pr.d.pipelines || [];
      const stageName = {};
      for (const p of pipes) for (const st of (p.stages || [])) stageName[st.id] = { stage: st.name, pipeline: p.name };
      let opps = [], guard = 0, url = `${API}/opportunities/search?location_id=${encodeURIComponent(loc)}&limit=100`;
      while (url && guard++ < 5) {
        const { ok, status, d } = await getJSON(url);
        if (!ok) return json({ error: 'GHL opps ' + status + ' ' + (d.message || '') });
        opps = opps.concat(d.opportunities || []);
        const next = d.meta && d.meta.nextPageUrl;
        url = (next && opps.length < 300) ? next : null;
      }
      return json({
        pipelines: pipes.map(p => ({ id: p.id, name: p.name, stages: (p.stages || []).map(st => ({ id: st.id, name: st.name })) })),
        total: opps.length,
        opportunities: opps.map(o => ({
          id: o.id, name: o.name, value: o.monetaryValue || 0, status: o.status,
          contact: (o.contact && (o.contact.name || o.contact.email)) || '',
          stage: (stageName[o.pipelineStageId] || {}).stage || '',
          pipeline: (stageName[o.pipelineStageId] || {}).pipeline || ''
        }))
      });
    }

    if (act === 'conversations') {
      const { ok, status, d } = await getJSON(`${API}/conversations/search?locationId=${encodeURIComponent(loc)}&limit=30`);
      if (!ok) return json({ error: 'GHL conversations ' + status + ' ' + (d.message || '') + ' (token needs conversations.readonly scope)' });
      return json({
        total: (d.conversations || []).length,
        conversations: (d.conversations || []).map(c => ({
          id: c.id, contact: c.fullName || c.contactName || c.email || c.phone || '',
          last: c.lastMessageBody || '', type: c.lastMessageType || c.type || '',
          unread: c.unreadCount || 0, updated: c.dateUpdated || c.lastMessageDate
        }))
      });
    }

    if (act === 'messages') {
      const cid = u.searchParams.get('conversationId');
      const { ok, status, d } = await getJSON(`${API}/conversations/${encodeURIComponent(cid)}/messages`);
      if (!ok) return json({ error: 'GHL messages ' + status + ' ' + (d.message || '') });
      const msgs = (d.messages && d.messages.messages) || d.messages || [];
      return json({ messages: msgs.map(m => ({ body: m.body || '', direction: m.direction, type: m.messageType || m.type, date: m.dateAdded })) });
    }

    if (act === 'social-accounts') {
      const { ok, status, d } = await getJSON(`${API}/social-media-posting/${encodeURIComponent(loc)}/accounts`);
      if (!ok) return json({ error: 'GHL ' + status + ' ' + (d.message || '') + ' (token needs socialplanner/account.readonly)' });
      // find the accounts array wherever GHL nests it
      const findArr = (o, depth = 0) => {
        if (Array.isArray(o)) return o;
        if (o && typeof o === 'object' && depth < 4) {
          for (const key of ['accounts', 'results', 'data', 'socialAccounts']) if (Array.isArray(o[key])) return o[key];
          for (const v of Object.values(o)) { const r = findArr(v, depth + 1); if (r) return r; }
        }
        return null;
      };
      const accts = findArr(d) || [];
      return json({ accounts: accts.map(a => ({ id: a.id || a._id || a.accountId, name: a.name || a.accountName || a.displayName || a.platform || 'account', platform: String(a.platform || a.type || a.provider || '').toLowerCase(), avatar: a.avatar || a.profilePicture })) , raw: accts.length ? undefined : Object.keys(d || {}) });
    }
    if (act === 'social-posts') {
      const r = await fetch(`${API}/social-media-posting/${encodeURIComponent(loc)}/posts/list`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'recent', accounts: [], skip: 0, limit: 40 }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: 'GHL ' + r.status + ' ' + (d.message || '') });
      const posts = d.posts || d.results || (d.data && d.data.posts) || [];
      return json({ posts: posts.map(p => ({ id: p._id || p.id, summary: p.summary || '', status: p.status, schedule: p.scheduleDate || p.publishedAt || p.createdAt, accounts: p.accountIds || [] })) });
    }

    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch {}
      if (act === 'create-contact') {
        const r = await fetch(`${API}/contacts/`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: loc, firstName: b.firstName || '', lastName: b.lastName || '', email: b.email || undefined, phone: b.phone || undefined }) });
        const d = await r.json().catch(() => ({}));
        return r.ok ? json({ ok: true, id: d.contact && d.contact.id }) : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || '') });
      }
      if (act === 'add-note') {
        const r = await fetch(`${API}/contacts/${encodeURIComponent(b.contactId)}/notes`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: b.note || '' }) });
        const d = await r.json().catch(() => ({}));
        return r.ok ? json({ ok: true }) : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || '') });
      }
      if (act === 'send-message') {
        const r = await fetch(`${API}/conversations/messages`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: b.type || 'SMS', contactId: b.contactId, message: b.message }) });
        const d = await r.json().catch(() => ({}));
        return r.ok ? json({ ok: true }) : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || '') });
      }
      if (act === 'social-create') {
        const r = await fetch(`${API}/social-media-posting/${encodeURIComponent(loc)}/posts`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountIds: b.accountIds || [],
            summary: b.summary || '',
            media: (b.media || []).map(m => (typeof m === 'string' ? { url: m, type: 'image' } : m)),
            status: b.scheduleDate ? 'scheduled' : 'draft',
            scheduleDate: b.scheduleDate || undefined,
            type: b.type || 'post'
          }) });
        const d = await r.json().catch(() => ({}));
        return r.ok ? json({ ok: true, id: (d.post && (d.post._id || d.post.id)) || d.id, status: b.scheduleDate ? 'scheduled' : 'draft' })
                    : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || JSON.stringify(d).slice(0, 200)) + ' (needs socialplanner/post.write)' });
      }
      if (act === 'update-opp') {
        if (b.status) {
          const r = await fetch(`${API}/opportunities/${encodeURIComponent(b.id)}/status`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: b.status }) });
          const d = await r.json().catch(() => ({}));
          return r.ok ? json({ ok: true }) : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || '') });
        }
        if (b.stageId) {
          const r = await fetch(`${API}/opportunities/${encodeURIComponent(b.id)}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ pipelineStageId: b.stageId }) });
          const d = await r.json().catch(() => ({}));
          return r.ok ? json({ ok: true }) : json({ ok: false, error: 'GHL ' + r.status + ' ' + (d.message || '') });
        }
      }
    }
    return json({ ok: true });
  } catch (e) { return json({ error: 'fetch failed: ' + String(e.message || e) }); }
};
export const config = { path: '/api/ghl' };
