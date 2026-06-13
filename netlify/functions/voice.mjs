// BENJI OS — TwiML for outbound softphone calls. Twilio hits this URL on connect.
// Set the TwiML App Voice URL to: https://jarvis.advancedmarketing.co/api/voice?callerId=+1YOURTWILIONUMBER
export default async (req) => {
  const u = new URL(req.url);
  let to = u.searchParams.get('To') || '';
  let cidParam = '';
  if (req.method === 'POST') {
    try { const p = new URLSearchParams(await req.text()); to = p.get('To') || to; cidParam = p.get('callerId') || ''; } catch {}
  }
  const cid = cidParam || u.searchParams.get('callerId') || process.env.TWILIO_CALLER_ID || '';
  const safe = s => String(s || '').replace(/[^+0-9a-zA-Z@.]/g, '');
  const xml = to
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${safe(cid)}"><Number>${safe(to)}</Number></Dial></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No number provided.</Say></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
};
export const config = { path: '/api/voice' };
