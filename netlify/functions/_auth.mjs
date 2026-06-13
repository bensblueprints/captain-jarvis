// Shared passcode gate for all BENJI OS functions
export function gate(req) {
  const passcode = process.env.JARVIS_PASSCODE;
  if (passcode && req.headers.get('x-jarvis-passcode') !== passcode) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return null;
}
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
