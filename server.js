// TRICKMATES — HTTP + WebSocket server
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Match } from './game.js';
import { other } from '../shared/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 8080;
const MOUNTS = [
  ['/shared/', path.join(ROOT, 'shared')],
  ['/vendor/three/', path.join(ROOT, 'node_modules/three')],
  ['/', path.join(ROOT, 'public')],
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (url === '/models.json') {
    const dir = path.join(ROOT, 'public/assets/models');
    const list = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.glb')) : [];
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(list));
  }
  if (url === '/') url = '/index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const file = path.join(dir, url.slice(prefix.length));
    if (!file.startsWith(dir)) break;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': prefix === '/vendor/three/' ? 'public, max-age=86400' : 'no-cache',
      });
      return fs.createReadStream(file).pipe(res);
    }
    if (prefix !== '/') { res.writeHead(404); return res.end('not found'); }
  }
  res.writeHead(404); res.end('not found');
});

// ---------- rooms ----------
const matches = new Map();   // code -> Match
const tokens = new Map();    // token -> { code, char }
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => {
  let c;
  do { c = Array.from({ length: 5 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join(''); } while (matches.has(c));
  return c;
};

function transportFor(match) {
  return (char, msg) => {
    const ws = match.players[char].ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
}

function bind(ws, match, char) {
  const token = match.players[char].token || crypto.randomBytes(16).toString('hex');
  tokens.set(token, { code: match.code, char });
  ws.ctx = { match, char };
  ws.send(JSON.stringify({ type: 'joined', code: match.code, you: char, token, host: match.host || char }));
  match.attach(char, ws, token);
  if (match.phase !== 'lobby') ws.send(JSON.stringify(match.snapshot(char)));
  if (match.phase === 'results' && match.results) ws.send(JSON.stringify({ type: 'ev', ev: 'results', ...match.results }));
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const err = (message) => ws.send(JSON.stringify({ type: 'error', message }));
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.type !== 'string') return;
    if (!ws.ctx) {
      if (m.type === 'create') {
        const char = m.char === 'shorok' ? 'shorok' : 'omar';
        const code = newCode();
        const match = new Match(code, null);
        match.transport = transportFor(match);
        matches.set(code, match);
        match.host = char;
        return bind(ws, match, char);
      }
      if (m.type === 'join') {
        const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const match = matches.get(code);
        if (!match) return err('Room not found. Check the code and try again.');
        const free = ['omar', 'shorok'].find(c => !match.players[c].token);
        if (!free) return err('That room is already full.');
        return bind(ws, match, free);
      }
      if (m.type === 'resume') {
        const t = tokens.get(String(m.token || ''));
        const match = t && matches.get(t.code);
        if (!match || match.players[t.char].token !== m.token) return ws.send(JSON.stringify({ type: 'resume_failed' }));
        const prev = match.players[t.char].ws;
        if (prev && prev !== ws) { prev.ctx = null; try { prev.close(); } catch {} }
        return bind(ws, match, t.char);
      }
      return;
    }
    const { match, char } = ws.ctx;
    if (m.type === 'leave') {
      const tok = match.players[char].token;
      tokens.delete(tok);
      ws.ctx = null;
      match.leave(char);
      if (!match.players.omar.token && !match.players.shorok.token) matches.delete(match.code);
      return;
    }
    try { match.handle(char, m); } catch (e) { console.error('handle error', e); }
  });
  ws.on('close', () => {
    if (!ws.ctx) return;
    const { match, char } = ws.ctx;
    if (match.players[char].ws === ws) match.detach(char);
  });
});

// game tick + housekeeping
setInterval(() => { for (const m of matches.values()) { try { m.tick(); } catch (e) { console.error('tick', e); } } }, 100);
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
  const t = Date.now() / 1000;
  for (const [code, m] of matches) {
    if (m.empty() && t - m.lastActive > 600) {
      for (const c of ['omar', 'shorok']) tokens.delete(m.players[c].token);
      matches.delete(code);
    }
  }
}, 15000);

server.listen(PORT, () => console.log(`TRICKMATES server on http://localhost:${PORT}`));
export { other };
