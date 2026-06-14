# Deploy your own Captain Jarvis

Captain Jarvis is a single-page command center that runs on Netlify with a
Supabase database for cross-device sync. Each person runs their own private
copy: your data lives in *your* Supabase, your keys in *your* Netlify. Nobody
who deploys it can see anyone else's data.

You need three free accounts: **GitHub**, **Netlify**, and **Supabase**.

---

## 1. Get the code

Fork or download this repository into your own GitHub account.

## 2. Create your Supabase project

1. Go to https://supabase.com → **New project** (pick a region near you).
2. Open **SQL Editor** → **New query**, paste the contents of `schema.sql`
   from this repo, and click **Run**. You should see "Success".
3. Go to **Project Settings → API** and copy two values:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon / public** key (a long token — safe to expose to the browser)

## 3. Deploy to Netlify

1. Go to https://netlify.com → **Add new site → Import an existing project**.
2. Connect GitHub and pick your fork. Netlify auto-detects the settings
   (publish directory `.`, functions in `netlify/functions`). Click **Deploy**.

## 4. Add your environment variables

In Netlify: **Site configuration → Environment variables → Add a variable**.
At minimum add the two Supabase values (see `.env.example` for the full list):

| Key                 | Value                                   |
|---------------------|-----------------------------------------|
| `SUPABASE_URL`      | your Project URL from step 2            |
| `SUPABASE_ANON_KEY` | your anon/public key from step 2       |

Then **Deploys → Trigger deploy → Deploy site** so the new variables take effect.

## 5. First run

Open your site. Set a passcode when prompted, then the **Startup Configuration**
wizard appears:

- **What should JARVIS call you?** — your name.
- **Tell JARVIS about you / your business** — context the AI uses in every reply.
- **Run on startup** — pick what fires when the app opens (daily briefing,
  plan-my-day, status refresh, cloud pull).

Save, and you're live. Data now syncs through your Supabase to every device you
open the site on. You can reopen this wizard anytime from the **Keys** tab →
**Startup Configuration**.

## Optional integrations

The **Keys** tab holds optional connections (Shopify, GoHighLevel, social APIs,
fal.ai, OpenAI, Twilio, a desktop mail bridge, etc.). Add only what you use.
Server-side integrations read their keys from the Netlify environment variables
listed in `.env.example`.

---

### Notes
- The **anon key is meant to be public** — it only allows what your Supabase
  Row Level Security policies allow. The included `schema.sql` opens access to
  the anon role so a single-user private dashboard works out of the box. If you
  add Supabase Auth later, tighten the policies (a stricter set is included,
  commented, at the bottom of `schema.sql`).
- The optional desktop **mail bridge** and **Ollama nodes** are blank by default;
  set them in-app only if you run them.
