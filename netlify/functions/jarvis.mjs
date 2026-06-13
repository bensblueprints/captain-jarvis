// BENJI OS — Claude brain proxy
// Set ANTHROPIC_API_KEY in Netlify: Site settings > Environment variables
// Optional: set JARVIS_PASSCODE to require a passcode header from the app.

export default async (req) => {
  const apiKey = req.headers.get('x-cfg-anthropic') || process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: !!apiKey, service: 'jarvis' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set in Netlify environment variables.' }), { status: 500 });
  }

  // Optional passcode gate so strangers can't burn your API credits
  const passcode = process.env.JARVIS_PASSCODE;
  if (passcode && req.headers.get('x-jarvis-passcode') !== passcode) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: body.max_tokens || 1000,
      system: body.system,
      messages: body.messages
    })
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/jarvis' };
