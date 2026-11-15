# TRICKMATES 🕷️
**Online multiplayer couple prank game — starring Omar & Shorok**

Two players, two devices, one cozy house, 23 harmless cartoon pranks. Rig the house, lure your partner, dodge their traps, and win 3 rounds of playful chaos.

- `docs/GDD.md` — full Game Design Document (reference analysis, rooms, pranks, scoring, UI)
- `docs/ARCHITECTURE.md` — technical architecture + network protocol

## Run it locally
Requires Node.js 18+.
```bash
npm install
npm start            # http://localhost:8080
```
Open the page, **Create Private Room**, send the 5-letter code (or the invite link) to your partner. They choose **Join Room** and enter it. The creator presses **Start Match**.

To play with someone on the **same Wi-Fi**, they open `http://<your-computer-LAN-IP>:8080`.
To play over the **internet without deploying**, run a tunnel such as `npx cloudflared tunnel --url http://localhost:8080` and share the https link it prints.

## Deploy (so you can play from anywhere)
No API keys or databases are needed — just a host that runs Node and supports WebSockets.

**Render.com (free tier)**
1. Push this folder to a GitHub repo.
2. Render → New → Blueprint → pick the repo (it reads `render.yaml`). Or New → Web Service: build `npm ci --omit=dev`, start `node server/server.js`.
3. Open the `https://….onrender.com` URL on both devices. (Free instances sleep when idle; the first load can take ~30 s.)

**Railway / Fly.io / any VPS** — use the included `Dockerfile` (listens on `$PORT`, default 8080, health check at `/healthz`).

## Controls
WASD / arrows move · Shift run · click floor to walk · **hold E** prepare prank / do chore · **hold F** search · **T** toolbox · **Q** fake doorbell · **1–4** emotes · **Esc** pause · mouse wheel zoom. Phones/tablets get a joystick and buttons.

## Tests
```bash
npm run dev & npm run test:protocol   # two raw WebSocket clients exercise every server rule
npm run test:e2e                      # two separate headless browsers play a real match (needs Playwright)
```

## Upgrading the 3D characters
The game ships with procedural Omar & Shorok rigs (faces with eyes, lids, brows, mouths and blush that switch with 9 emotions; full-body animation states). For sculpted models that exactly match the reference renders, drop rigged glTF files at
`public/assets/models/omar.glb` and `public/assets/models/shorok.glb`
with animation clips named `Idle, Walk, Run, Interact, Prepare, Surprised, Scared, Laugh, Angry, Sad, Embarrassed, Victory`. They're picked up automatically.
