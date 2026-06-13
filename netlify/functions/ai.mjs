// BENJI OS — universal AI proxy. Routes to Groq, Kimi (Moonshot), or Claude.
// Keys arrive as headers from the Keys tab (x-cfg-groq, x-cfg-kimi, x-cfg-anthropic),
// or fall back to env (GROQ_API_KEY, KIMI_API_KEY, ANTHROPIC_API_KEY).
import { gate } from './_auth.mjs';

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyHeader: 'x-cfg-groq', env: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    auth: k => ({ Authorization: 'Bearer ' + k })
  },
  kimi: {
    url: 'https://api.moonshot.ai/v1/chat/completions',
    keyHeader: 'x-cfg-kimi', env: 'KIMI_API_KEY',
    defaultModel: 'kimi-k2-0905-preview',
    auth: k => ({ Authorization: 'Bearer ' + k })
  }
};

function out(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  if (req.method === 'GET') {
    // capability probe: which providers have a key configured (header or env)
    const have = {};
    for (const [name, p] of Object.entries(PROVIDERS)) have[name] = !!(req.headers.get(p.keyHeader) || process.env[p.env]);
    have.claude = !!(req.headers.get('x-cfg-anthropic') || process.env.ANTHROPIC_API_KEY);
    return out({ ok: true, providers: have });
  }
  let body; try { body = await req.json(); } catch { return out({ error: 'bad json' }, 400); }
  const provider = body.provider || 'groq';

  // Claude routes through Anthropic's native API
  if (provider === 'claude') {
    const key = req.headers.get('x-cfg-anthropic') || process.env.ANTHROPIC_API_KEY;
    if (!key) return out({ error: 'no Claude key' }, 400);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: body.model || 'claude-sonnet-4-20250514', max_tokens: body.max_tokens || 1000, system: body.system, messages: body.messages })
    });
    const d = await r.json().catch(() => ({}));
    const text = Array.isArray(d.content) ? d.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() : '';
    return out({ text, provider: 'claude', error: text ? undefined : (d.error && d.error.message) });
  }

  const p = PROVIDERS[provider];
  if (!p) return out({ error: 'unknown provider ' + provider }, 400);
  const key = req.headers.get(p.keyHeader) || process.env[p.env];
  if (!key) return out({ error: 'no key for ' + provider }, 400);

  const messages = body.system ? [{ role: 'system', content: body.system }, ...(body.messages || [])] : (body.messages || []);
  try {
    const r = await fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...p.auth(key) },
      body: JSON.stringify({ model: body.model || p.defaultModel, messages, max_tokens: body.max_tokens || 1000, temperature: body.temperature ?? 0.7 })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return out({ error: (d.error && (d.error.message || d.error)) || ('HTTP ' + r.status), provider });
    const text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return out({ text: (text || '').trim(), provider, model: body.model || p.defaultModel });
  } catch (e) { return out({ error: String(e.message || e), provider }); }
};
export const config = { path: '/api/ai' };
