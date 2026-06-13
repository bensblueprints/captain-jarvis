// BENJI OS — Shopify multi-store stats v2
// Config, either source (header wins):
//  1) x-cfg-shopify header from the app's Keys tab: JSON [{name,domain,token}, ...]
//  2) Env: SHOPIFY_STORES=name:domain,...  +  SHOPIFY_TOKEN_<NAME>=shpat_...
// Tokens should be custom-app Admin API tokens with read_orders scope ONLY.
import { gate, json } from './_auth.mjs';

function storesFromEnv() {
  const env = process.env.SHOPIFY_STORES;
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [name, domain] = s.includes(':') ? s.split(':') : [s.split('.')[0], s];
    const token = process.env['SHOPIFY_TOKEN_' + name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')];
    return { name: name.trim(), domain: domain.trim(), token };
  });
}

export default async (req) => {
  const denied = gate(req); if (denied) return denied;

  let entries = [];
  const hdr = req.headers.get('x-cfg-shopify');
  if (hdr) { try { entries = JSON.parse(hdr).filter(s => s && s.domain && s.token); } catch {} }
  if (!entries.length) entries = storesFromEnv();
  if (!entries.length) return json({ error: 'not_configured' });

  // "Today" follows Benji ops time (ICT). Buckets use the store-local date on each order.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayStr = fmt.format(new Date());
  const yestStr = fmt.format(new Date(Date.now() - 86400000));
  const d30 = new Date(Date.now() - 30 * 86400000);
  const d7cut = new Date(Date.now() - 7 * 86400000);

  const stores = await Promise.all(entries.map(async (st) => {
    const name = st.name || st.domain.split('.')[0];
    if (!st.token) return { name, error: 'missing token' };
    try {
      let url = `https://${st.domain}/admin/api/2024-10/orders.json?status=any&created_at_min=${d30.toISOString()}&limit=250&fields=created_at,total_price,cancelled_at,test,currency,line_items`;
      let orders = [], guard = 0;
      while (url && guard++ < 12) {
        const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': st.token } });
        if (!r.ok) return { name, error: `Shopify ${r.status}` + (r.status === 401 ? ' (token rejected)' : r.status === 404 ? ' (domain wrong?)' : '') };
        const page = await r.json();
        orders = orders.concat(page.orders || []);
        const m = (r.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/);
        url = m ? m[1] : null;
      }
      orders = orders.filter(o => !o.cancelled_at && !o.test);
      const daily = {};
      for (let i = 29; i >= 0; i--) daily[fmt.format(new Date(Date.now() - i * 86400000))] = 0;
      const d14cut = new Date(Date.now() - 14 * 86400000);
      let today = 0, yesterday = 0, last7 = 0, last30 = 0, ordersToday = 0, orders7 = 0, prev7 = 0;
      const prod = {};
      for (const o of orders) {
        const v = parseFloat(o.total_price || 0);
        const d = (o.created_at || '').slice(0, 10);
        last30 += v;
        if (d in daily) daily[d] += v;
        if (d === todayStr) { today += v; ordersToday++; }
        if (d === yestStr) yesterday += v;
        const cd = new Date(o.created_at);
        if (cd >= d7cut) { last7 += v; orders7++; }
        else if (cd >= d14cut) { prev7 += v; }
        for (const li of (o.line_items || [])) {
          const k = li.title || 'item';
          prod[k] = prod[k] || { title: k, qty: 0, revenue: 0 };
          prod[k].qty += li.quantity || 0;
          prod[k].revenue += parseFloat(li.price || 0) * (li.quantity || 0);
        }
      }
      const r2 = n => Math.round(n * 100) / 100;
      // Funnel via ShopifyQL (sessions, add-to-carts, checkouts) — needs read_reports scope
      let funnel = null;
      try {
        const ql = 'FROM sessions SHOW sum(sessions) AS sessions, sum(add_to_carts) AS add_to_carts, sum(checkouts) AS checkouts, sum(orders) AS orders SINCE -30d UNTIL today';
        const gr = await fetch(`https://${st.domain}/admin/api/2024-10/graphql.json`, {
          method: 'POST', headers: { 'X-Shopify-Access-Token': st.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `{ shopifyqlQuery(query: ${JSON.stringify(ql)}) { __typename ... on PolarisVizResponse { data { rowData } columns: tableColumns { name dataType } } ... on TableResponse { tableData { rowData columns: columns { name } } } parseErrors { code message } } }` })
        });
        const gd = await gr.json().catch(() => ({}));
        const node = gd.data && gd.data.shopifyqlQuery;
        if (node && !(node.parseErrors && node.parseErrors.length)) {
          const cols = (node.columns || (node.tableData && node.tableData.columns) || []).map(c => c.name);
          const row = (node.data && node.data[0] && node.data[0].rowData) || (node.tableData && node.tableData.rowData && node.tableData.rowData[0]) || [];
          const get = nm => { const i = cols.indexOf(nm); return i >= 0 ? Number(row[i]) || 0 : 0; };
          const sess = get('sessions'), atc = get('add_to_carts'), chk = get('checkouts'), ord = get('orders');
          if (sess || atc || chk) funnel = { sessions: sess, addToCarts: atc, checkouts: chk, orders: ord, cr: sess ? r2(ord / sess * 100) : 0 };
        } else if (node && node.parseErrors && node.parseErrors.length) {
          funnel = { error: 'sessions/add-to-cart not exposed by Shopify Admin API (needs Web Pixel). ' + node.parseErrors[0].message };
        }
      } catch {}
      return {
        name,
        currency: (orders[0] && orders[0].currency) || 'USD',
        funnel,
        today: r2(today), yesterday: r2(yesterday), last7: r2(last7), prev7: r2(prev7), last30: r2(last30),
        ordersToday, orders7, orders30: orders.length,
        aov: orders.length ? r2(last30 / orders.length) : 0,
        daily: Object.entries(daily).map(([date, revenue]) => ({ date, revenue: r2(revenue) })),
        top: Object.values(prod).sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(p => ({ title: p.title, qty: p.qty, revenue: r2(p.revenue) }))
      };
    } catch (e) { return { name, error: 'fetch failed' }; }
  }));

  return json({ stores, fetchedAt: new Date().toISOString() });
};
export const config = { path: '/api/shopify' };
