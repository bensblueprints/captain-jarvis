// BENJI OS — GitHub repo context fetcher. Public repos need no token; private/rate-limit use x-cfg-github.
import { gate } from './_auth.mjs';
function out(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }
function parseRepo(u) {
  if (!u) return null;
  const m = String(u).replace(/\.git$/, '').match(/github\.com[/:]([^/]+)\/([^/#?]+)/) || String(u).match(/^([^/]+)\/([^/#?]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}
export default async (req) => {
  const denied = gate(req); if (denied) return denied;
  const tok = req.headers.get('x-cfg-github') || process.env.GITHUB_TOKEN;
  const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'benji-os' };
  if (tok) H.Authorization = 'Bearer ' + tok;
  const u = new URL(req.url);
  const action = u.searchParams.get('action') || 'info';
  const r = parseRepo(u.searchParams.get('repo'));
  if (!r) return out({ error: 'repo required (owner/name or github URL)' }, 400);
  const base = `https://api.github.com/repos/${r.owner}/${r.repo}`;
  try {
    if (action === 'file') {
      const path = u.searchParams.get('path') || '';
      const fr = await fetch(`${base}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, { headers: H });
      const fd = await fr.json().catch(() => ({}));
      if (!fr.ok) return out({ error: 'GitHub ' + fr.status + ' ' + (fd.message || '') });
      const content = fd.content ? Buffer.from(fd.content, 'base64').toString('utf8') : '';
      return out({ ok: true, path, content: content.slice(0, 100000), size: fd.size });
    }
    // default: repo info + readme + top file tree
    const [repoR, readmeR] = await Promise.all([
      fetch(base, { headers: H }),
      fetch(`${base}/readme`, { headers: { ...H, Accept: 'application/vnd.github.raw' } })
    ]);
    const repoD = await repoR.json().catch(() => ({}));
    if (!repoR.ok) return out({ error: 'GitHub ' + repoR.status + ' ' + (repoD.message || '') });
    const readme = readmeR.ok ? (await readmeR.text()).slice(0, 40000) : '';
    let tree = [];
    try {
      const tr = await fetch(`${base}/git/trees/${repoD.default_branch}?recursive=1`, { headers: H });
      const td = await tr.json().catch(() => ({}));
      tree = (td.tree || []).filter(t => t.type === 'blob').map(t => t.path).slice(0, 300);
    } catch {}
    return out({
      ok: true,
      repo: `${r.owner}/${r.repo}`,
      description: repoD.description || '',
      language: repoD.language || '',
      stars: repoD.stargazers_count || 0,
      defaultBranch: repoD.default_branch,
      url: repoD.html_url,
      readme, tree
    });
  } catch (e) { return out({ error: String(e.message || e) }); }
};
export const config = { path: '/api/github' };
