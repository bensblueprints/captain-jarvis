// BENJI OS — fal.ai: text/image -> image or video. Sync for images, queue for video.
// Key from Keys tab header x-cfg-fal, or env FAL_KEY. Accepts an input image as a data URI or URL.
import { gate } from './_auth.mjs';
function out(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const key = req.headers.get('x-cfg-fal') || process.env.FAL_KEY;
  const auth = { Authorization: 'Key ' + key, 'Content-Type': 'application/json' };

  // poll a queued job
  if (req.method === 'GET') {
    const u = new URL(req.url);
    if (!key) return out({ ok: !!key });
    const id = u.searchParams.get('poll'); const model = u.searchParams.get('model');
    if (!id || !model) return out({ ok: !!key });
    try {
      const sr = await fetch(`https://queue.fal.run/${model}/requests/${id}/status`, { headers: auth });
      const sd = await sr.json().catch(() => ({}));
      if (sd.status !== 'COMPLETED') return out({ ok: true, done: false, status: sd.status || 'IN_PROGRESS' });
      const rr = await fetch(`https://queue.fal.run/${model}/requests/${id}`, { headers: auth });
      const rd = await rr.json().catch(() => ({}));
      return out({ ok: true, done: true, ...extract(rd) });
    } catch (e) { return out({ error: String(e.message || e) }); }
  }

  if (!key) return out({ error: 'no fal.ai key — paste it in the Keys tab' }, 400);
  let body; try { body = await req.json(); } catch { return out({ error: 'bad json' }, 400); }
  const model = body.model || 'fal-ai/flux/schnell';
  // Client may send a fully-formed `input` object (preferred) — merge with conveniences.
  const input = (body.input && typeof body.input === 'object') ? { ...body.input } : {};
  if (body.prompt && input.prompt == null) input.prompt = body.prompt;
  if (body.image && input.image_url == null) input.image_url = body.image;          // data URI or https URL
  if (body.images && input.image_urls == null) input.image_urls = body.images;      // reference images
  if (body.size && input.image_size == null) input.image_size = body.size;
  if (body.count && input.num_images == null) input.num_images = body.count;
  if (body.strength != null && input.strength == null) input.strength = body.strength;
  if (body.duration && input.duration == null) input.duration = body.duration;
  if (!input.prompt && !input.image_url && !input.image_urls) return out({ error: 'prompt or image required' }, 400);

  try {
    if (body.queue) {
      // async (video): submit and return the request id for the client to poll
      const r = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: auth, body: JSON.stringify(input) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return out({ error: falErr(d, r.status) });
      return out({ ok: true, queued: true, requestId: d.request_id, model });
    }
    // sync (images)
    const r = await fetch('https://fal.run/' + model, { method: 'POST', headers: auth, body: JSON.stringify(input) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return out({ error: falErr(d, r.status) });
    return out({ ok: true, done: true, ...extract(d) });
  } catch (e) { return out({ error: String(e.message || e) }); }
};
function extract(d) {
  const images = (d.images || []).map(i => i.url).filter(Boolean);
  const video = (d.video && d.video.url) || (d.videos && d.videos[0] && d.videos[0].url) || null;
  return { images, video };
}
function falErr(d, status) {
  if (d.detail) return Array.isArray(d.detail) ? (d.detail[0] && d.detail[0].msg) : d.detail;
  return d.message || ('HTTP ' + status);
}
export const config = { path: '/api/fal' };
