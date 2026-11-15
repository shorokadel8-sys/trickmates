# TRICKMATES — Technical Architecture

## Stack
| Layer | Choice | Why |
|---|---|---|
| Rendering | **Three.js** (r17x, ES modules) | Runs in any modern browser incl. phones; warm PBR lighting, soft shadows, ACES tone mapping |
| Networking | **WebSocket** (`ws`) on a small **Node.js** server | Real-time, ~15 Hz position sync, server-authoritative game rules; no third-party credentials |
| Room management | In-memory on the same server | Private rooms + 5-letter invite codes; no database needed for 2-player sessions |
| Hosting | Any Node host with WebSocket support (Render, Railway, Fly.io, a VPS) | Dockerfile + `render.yaml` included |
| Optional later | Supabase / Firebase | Only if you want accounts, saved stats or leaderboards — not required to play |

## Layout
```
server/server.js     HTTP static server + WebSocket endpoint (/ws)
server/game.js       Authoritative Match: rounds, timer, traps, catches, scoring, chores, challenges
shared/data.js       Rooms, walls, hotspots, 23 pranks, rules — imported by BOTH server and client
public/index.html    Menus, HUD, toolbox, overlays
public/js/main.js    Boot, input, game loop, camera, interaction logic
public/js/net.js     WebSocket client with auto-reconnect (session token)
public/js/world.js   Procedural 3D house: 5 rooms, furniture, lights, colliders, hotspot anchors
public/js/characters.js  Omar & Shorok rigs: body, face (eyes/lids/brows/mouth), animation + emotion state machine; optional GLB override
public/js/fx.js      Prank visual effects (spider, rocket confetti, flour, foam, water, dino …) + synthesized audio
public/js/ui.js      HUD, toolbox, prank card, toasts, speech bubbles, results
public/assets/ref/   Portraits cropped from the uploaded expression sheets + menu art
test/two-player.mjs  Playwright test: two separate browser contexts play a full prank exchange
```

## Authority model
- **Client-predicted movement**: each client simulates its own character (collision against walls/furniture) and sends `{x,z,rot,anim}` at 15 Hz. Server clamps speed (anti-teleport) and relays; the other client interpolates.
- **Server-authoritative gameplay**: preparation timing, catch detection (10 Hz tick), trap ownership & secrecy (the victim's client never receives trap positions — only proximity "glints" for Med/High risk), triggers, stun, scoring, chores, challenges, round timer, pause, reconnect, rematch.
- **Events** (`prank`, `caught`, `defused`, `armed`, `miss`, `chore`, `lure`, `challenge`, `emote`) are broadcast to both clients so FX, reactions and bubbles play at the same moment on both screens.

## Protocol (JSON over WebSocket)
Client → server: `create{char}`, `join{code}`, `resume{token}`, `start`, `pos{x,z,r,a}`, `prep_start{prank}`, `prep_cancel`, `prep_done`, `interact{hs}`, `chore_done{hs}`, `search{hs}`, `activate{trap}`, `distract{room}`, `emote{e}`, `pause{on}`, `rematch`, `leave`.
Server → client: `joined{code,you,token}`, `lobby`, `state` (10 Hz snapshot, per-player view), `ev{…}` (one-shot events), `error`.

## Scaling notes
One Node process comfortably handles hundreds of concurrent 2-player rooms. For horizontal scale, pin rooms to instances (sticky sessions) or move room state to Redis.

## 3D asset pipeline (upgrade path)
The current characters are procedural rigs built in code so the game is fully playable today. To reach the exact sculpted look of the reference renders, supply rigged glTF models:
`public/assets/models/omar.glb` and `shorok.glb` with animation clips named `Idle, Walk, Run, Interact, Prepare, Surprised, Scared, Laugh, Angry, Sad, Embarrassed, Victory`. `characters.js` loads them automatically when present (falls back to the procedural rig).
