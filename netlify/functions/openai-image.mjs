// BENJI OS — OpenAI GPT Image (gpt-image-1) generate + edit. Uses your own OpenAI key (x-cfg-openai / OPENAI_API_KEY).
import { gate } from './_auth.mjs';
function out(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const key = req.headers.get('x-cfg-openai') || process.env.OPENAI_API_KEY;
  if (req.method === 'GET') return out({ ok: !!key });
  if (!key) return out({ error: 'no OpenAI key — paste it in the Keys tab' }, 400);
  let b; try { b = await req.json(); } catch { return out({ error: 'bad json' }, 400); }
  if (!b.prompt) return out({ error: 'prompt required' }, 400);
  const model = b.model || 'gpt-image-1';
  const size = (b.size && /^\d+x\d+$/.test(b.size)) ? b.size : 'auto';
  const quality = b.quality || 'high';
  try {
    let r;
    if (b.image) {
      // edit: multipart to /v1/images/edits
      const m = String(b.image).match(/^data:([^;]+);base64,(.+)$/);
      const mime = m ? m[1] : 'image/png';
      const bytes = Buffer.from(m ? m[2] : b.image, 'base64');
      const fd = new FormData();
      fd.append('model', model);
      fd.append('prompt', b.prompt);
      fd.append('size', size);
      fd.append('image', new Blob([bytes], { type: mime }), 'input.png');
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: b.prompt, size, quality, n: b.count || 1 })
      });
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return out({ error: (d.error && d.error.message) || ('HTTP ' + r.status) });
    const images = (d.data || []).map(im => im.url ? im.url : (im.b64_json ? 'data:image/png;base64,' + im.b64_json : null)).filter(Boolean);
    return out({ ok: true, done: true, images });
  } catch (e) { return out({ error: String(e.message || e) }); }
};
export const config = { path: '/api/openai-image' };
