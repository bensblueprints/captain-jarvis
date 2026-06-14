// BENJI OS — AI news aggregator. Pulls recent headlines from trusted AI sources (server-side RSS).
import { gate } from './_auth.mjs';
function out(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

const SOURCES = [
  ['OpenAI', 'https://openai.com/news/rss.xml'],
  ['Google DeepMind', 'https://deepmind.google/blog/feed/basic/'],
  ['MIT Technology Review', 'https://www.technologyreview.com/topic/artificial-intelligence/feed/'],
  ['The Verge AI', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'],
  ['Ars Technica', 'https://arstechnica.com/ai/feed/'],
  ['VentureBeat AI', 'https://venturebeat.com/category/ai/feed/'],
  ['TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/feed/'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
  ['The Batch (DeepLearning.AI)', 'https://www.deeplearning.ai/the-batch/feed/'],
  ['arXiv cs.AI', 'http://export.arxiv.org/rss/cs.AI']
];

function decode(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return m ? m[1] : '';
}
function linkOf(block) {
  let l = tag(block, 'link');
  if (l && /^https?:/i.test(l.trim())) return l.trim();
  const m = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : '';
}
function parseFeed(xml, max = 4) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1).concat(xml.split(/<entry[\s>]/i).slice(1));
  for (const block of blocks) {
    const title = decode(tag(block, 'title'));
    if (!title) continue;
    const link = linkOf(block);
    const date = decode(tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published') || tag(block, 'dc:date'));
    items.push({ title: title.slice(0, 200), link, date });
    if (items.length >= max) break;
  }
  return items;
}
async function fetchFeed([name, url], ms = 8000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'benji-os-ainews/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
    clearTimeout(t);
    if (!r.ok) return { source: name, error: 'HTTP ' + r.status, items: [] };
    const xml = await r.text();
    return { source: name, items: parseFeed(xml) };
  } catch (e) { clearTimeout(t); return { source: name, error: String(e.name || e.message || e), items: [] }; }
}

export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  try {
    const results = await Promise.all(SOURCES.map(s => fetchFeed(s)));
    const sources = results.filter(r => r.items.length);
    const flat = [];
    for (const s of sources) for (const it of s.items) flat.push({ source: s.source, ...it });
    return out({ ok: true, fetchedAt: Date.now(), sourceCount: sources.length, sources, headlines: flat.slice(0, 40) });
  } catch (e) { return out({ error: String(e.message || e) }, 500); }
};
export const config = { path: '/api/ainews' };
