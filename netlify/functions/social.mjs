// BENJI OS — Social metrics: Meta page, Instagram business, YouTube channel, TikTok
// Env (any subset):
//   META_ACCESS_TOKEN + META_PAGE_ID          (Facebook page fans + reach)
//   META_ACCESS_TOKEN + IG_BUSINESS_ID        (Instagram followers + reach)
//   YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID      (subs, views, videos)
//   TIKTOK_ACCESS_TOKEN                       (follower count via display API)
import { gate, json } from './_auth.mjs';

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d };
}

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const out = { meta: {}, instagram: {}, youtube: {}, tiktok: {} };
  let cfg = {};
  try { cfg = JSON.parse(req.headers.get('x-cfg-social') || '{}'); } catch {}
  const metaTok = cfg.metaToken || process.env.META_ACCESS_TOKEN;
  const PAGE = cfg.pageId || process.env.META_PAGE_ID;
  const IG = cfg.igId || process.env.IG_BUSINESS_ID;
  const YTK = cfg.ytKey || process.env.YOUTUBE_API_KEY;
  const YTC = cfg.ytChannel || process.env.YOUTUBE_CHANNEL_ID;
  const TT = cfg.ttToken || process.env.TIKTOK_ACCESS_TOKEN;

  // Facebook Page
  if (metaTok && PAGE) {
    const { ok, d } = await getJSON(`https://graph.facebook.com/v21.0/${PAGE}?fields=fan_count,name&access_token=${metaTok}`);
    out.meta = ok ? { connected: true, followers: d.fan_count || 0, label: 'page likes', extra: {} }
                  : { connected: false, error: d.error && d.error.message };
  }
  // Instagram Business
  if (metaTok && IG) {
    const { ok, d } = await getJSON(`https://graph.facebook.com/v21.0/${IG}?fields=followers_count,media_count,username&access_token=${metaTok}`);
    out.instagram = ok ? { connected: true, followers: d.followers_count || 0, label: '@' + (d.username || 'instagram'), extra: { posts: d.media_count || 0 } }
                       : { connected: false, error: d.error && d.error.message };
  }
  // YouTube
  if (YTK && YTC) {
    const { ok, d } = await getJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YTC}&key=${YTK}`);
    const st = ok && d.items && d.items[0] && d.items[0].statistics;
    out.youtube = st ? { connected: true, followers: +st.subscriberCount || 0, label: 'subscribers', extra: { 'total views': +st.viewCount || 0, videos: +st.videoCount || 0 } }
                     : { connected: false, error: (d.error && d.error.message) || 'no channel data' };
  }
  // TikTok
  if (TT) {
    const { ok, d } = await getJSON('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count', {
      headers: { Authorization: 'Bearer ' + TT }
    });
    const u = ok && d.data && d.data.user;
    out.tiktok = u ? { connected: true, followers: u.follower_count || 0, label: u.display_name || 'tiktok', extra: { likes: u.likes_count || 0, videos: u.video_count || 0 } }
                   : { connected: false, error: (d.error && d.error.message) || 'token invalid or expired' };
  }
  return json({ platforms: out });
};
export const config = { path: '/api/social' };
