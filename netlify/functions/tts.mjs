// BENJI OS — ElevenLabs TTS proxy + voice list. Key from env ELEVENLABS_KEY or header x-cfg-eleven.
import { gate } from './_auth.mjs';
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const key = req.headers.get('x-cfg-eleven') || process.env.ELEVENLABS_KEY || process.env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: 'no ElevenLabs key — add it in the Keys tab or set ELEVENLABS_KEY' }, 400);

  // GET ?list=1 -> available voices (id + name + category)
  if (req.method === 'GET') {
    const u = new URL(req.url);
    if (u.searchParams.get('list')) {
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: 'ElevenLabs ' + r.status }, 502);
        const voices = (d.voices || []).map(v => ({ id: v.voice_id, name: v.name, category: v.category || '' }));
        return json({ ok: true, voices });
      } catch (e) { return json({ error: String(e.message || e) }, 500); }
    }
    return json({ ok: true });
  }

  // POST { text, voiceId, model? } -> audio/mpeg
  let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const text = (body.text || '').toString().slice(0, 5000);
  const voiceId = body.voiceId || body.voice_id;
  if (!text || !voiceId) return json({ error: 'text and voiceId required' }, 400);
  const model = body.model || 'eleven_turbo_v2_5';
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } })
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return json({ error: 'ElevenLabs ' + r.status + ' ' + t.slice(0, 200) }, 502); }
    const buf = await r.arrayBuffer();
    return new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
};
export const config = { path: '/api/tts' };
