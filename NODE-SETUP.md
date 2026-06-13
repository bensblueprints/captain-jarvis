# BENJI OS Node Controller — Desktop Brain Setup (15 min, zero API cost)

Turns your RTX 5060 Ti machine into the Jarvis brain. The web app talks to it
over your Tailscale network from anywhere. Netlify never sees the traffic.

## 1. Install Ollama on the desktop (Windows)
Download from https://ollama.com and install.
Then in PowerShell:
    ollama pull llama3.1:8b
(8b runs comfortably on the 5060 Ti. Try qwen2.5:14b later if you want smarter.)

## 2. Make Ollama listen on your tailnet and accept the web app
Set these as Windows environment variables (System > Environment Variables),
then restart Ollama:
    OLLAMA_HOST = 0.0.0.0
    OLLAMA_ORIGINS = https://YOUR-SITE.netlify.app
The ORIGINS line means ONLY your deployed BENJI OS can call it from a browser.

## 3. Find your Tailscale address
On the desktop: tailscale ip -4   (looks like 100.x.x.x)
Your node URL is: http://100.x.x.x:11434

## 4. Link it in BENJI OS
Open your deployed site, tap "NODE ○ link desktop" under the chat,
paste the node URL, confirm the model name. Done.

## 5. Phone access
Install the Tailscale app on your phone and sign in. While Tailscale is on,
BENJI OS on your phone reaches your desktop brain from anywhere on earth.

## How routing works
Every message tries your desktop node first. If the PC is off or unreachable,
it falls back to the Netlify cloud function (which needs ANTHROPIC_API_KEY).
Run node-only, cloud-only, or both.

## Security rules
- Never set OLLAMA_ORIGINS to * and never port-forward 11434 on your router.
  Tailscale-only. If it is reachable without Tailscale, it is misconfigured.
- The passcode still gates all the Netlify endpoints (stores, social, inbox).

## Browser note (mixed content)
Your site is https and the node is http. Tailscale addresses are private so
Chrome generally allows it, but if the browser blocks the call:
enable Tailscale HTTPS (tailscale cert) or run "tailscale serve 11434"
on the desktop and use the https URL it gives you as the node URL.
