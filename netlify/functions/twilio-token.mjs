// BENJI OS — Twilio Voice access token (manual JWT, no SDK dependency)
// Keys tab header x-cfg-twilio {accountSid, apiKey, apiSecret, twimlAppSid}, or env equivalents
import crypto from 'node:crypto';
import { gate, json } from './_auth.mjs';
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  let cfg = {}; try { cfg = JSON.parse(req.headers.get('x-cfg-twilio') || '{}'); } catch {}
  const sid = cfg.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const key = cfg.apiKey || process.env.TWILIO_API_KEY;
  const secret = cfg.apiSecret || process.env.TWILIO_API_SECRET;
  const app = cfg.twimlAppSid || process.env.TWILIO_TWIML_APP_SID;
  if (!sid || !key || !secret || !app) return json({ error: 'not_configured' });
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' };
  const payload = {
    jti: key + '-' + now, iss: key, sub: sid, iat: now, exp: now + 3600,
    grants: { identity: 'benji', voice: { outgoing: { application_sid: app } } }
  };
  const base = b64u(header) + '.' + b64u(payload);
  const sig = crypto.createHmac('sha256', secret).update(base).digest('base64url');
  return json({ token: base + '.' + sig, identity: 'benji' });
};
export const config = { path: '/api/twilio-token' };
