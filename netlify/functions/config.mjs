// Serves the deployer's own public Supabase creds to the frontend.
// Reads from this site's Netlify env vars — nothing is hardcoded in the repo.
// The anon key is safe to expose to the browser (that is its purpose).
export default async () => {
  const body = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
export const config = { path: '/api/config' };
