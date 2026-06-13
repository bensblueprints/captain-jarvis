# Captain JARVIS

Personal AI command center for Advanced Marketing / Benji's AI Empire — live at **jarvis.advancedmarketing.co**.

Single-file web app (`index.html`) on Netlify with serverless functions for fal.ai (image/video studio),
GoHighLevel CRM + social scheduling, Shopify funnel analytics, multi-provider AI brain (Groq/Kimi/Claude/Ollama),
email bridge, and multi-device sync.

## Structure
- `index.html` — the entire app UI + logic
- `netlify/functions/` — fal, ghl, shopify, github, sync, pixel, auth
- `assets/granny-ingredients/` — GotBeef Granny campaign images
- `sw.js`, `manifest.json`, icons — PWA shell

## Deploy
Push to the connected Netlify project; env vars (FAL_KEY, GHL_TOKEN, GHL_LOCATION_ID, GITHUB_TOKEN, etc.)
are set in Netlify, scope "all".
