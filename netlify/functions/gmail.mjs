// BENJI OS — Gmail recent threads (READ ONLY)
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Use scope https://www.googleapis.com/auth/gmail.readonly when minting the refresh token.
// Drafting happens in JARVIS chat. You send from Gmail yourself. Nothing here can send or delete.
import { gate, json } from './_auth.mjs';

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return json({ error: 'not_configured' });

  try {
    // Refresh token -> access token
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token'
      })
    });
    const tok = await tr.json();
    if (!tok.access_token) return json({ error: 'oauth refresh failed' });
    const H = { Authorization: 'Bearer ' + tok.access_token };

    const lr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=in:inbox', { headers: H });
    const list = await lr.json();
    if (!list.messages) return json({ messages: [] });

    const messages = await Promise.all(list.messages.map(async m => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers: H });
      const d = await r.json();
      const h = Object.fromEntries((d.payload && d.payload.headers || []).map(x => [x.name, x.value]));
      return { id: m.id, from: h.From || '', subject: h.Subject || '', snippet: d.snippet || '' };
    }));
    return json({ messages });
  } catch (e) {
    return json({ error: 'gmail fetch failed' });
  }
};
export const config = { path: '/api/gmail' };
