// End-to-end test: two separate browser sessions play TRICKMATES against each other through the real server.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 8097, BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT || 'test/screens';
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, TM_DEBUG: '1' }, stdio: 'inherit' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await sleep(800);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 660 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(`${BASE}/?debug=1&quality=low`);
  return page;
}
const check = (c, msg) => { console.log((c ? 'ok   - ' : 'FAIL - ') + msg); if (!c) process.exitCode = 1; };
try {
  const A = await player('omar'), B = await player('shorok');
  await sleep(1500);
  await A.screenshot({ path: `${OUT}/01-menu.png` });
  await A.click('#menu [data-go=create]'); await sleep(300);
  await A.click('#btnCreate');
  await A.waitForFunction(() => /^[A-Z2-9]{5}$/.test(document.querySelector('#lobbyCode').textContent.trim()), null, { timeout: 15000 });
  const code = (await A.textContent('#lobbyCode')).trim();
  check(/^[A-Z2-9]{5}$/.test(code), 'room code shown: ' + code);
  await B.click('#menu [data-go=join]'); await B.fill('#joinCode', code); await B.click('#btnJoin');
  await A.waitForFunction(() => !document.querySelector('#btnStart').disabled, null, { timeout: 15000 }).catch(() => {});
  await A.screenshot({ path: `${OUT}/02-lobby.png` });
  check(await A.isEnabled('#btnStart'), 'host can start once partner joined');
  await A.click('#btnStart');
  await Promise.all([A, B].map(p => p.waitForFunction(() => window.__tm.G.inGame && window.__tm.G.snap?.phase === 'playing', null, { timeout: 20000 }).catch(() => {})));
  await sleep(1000);
  check(await A.isVisible('#hud') && await B.isVisible('#hud'), 'both players in game HUD');
  const me = async (p) => p.evaluate(() => window.__tm.G.me);
  check(await me(A) === 'omar' && await me(B) === 'shorok', 'Omar = player 1, Shorok = player 2');
  // movement sync: Omar walks right for 1s
  await A.evaluate(() => window.__tm.press('d')); await sleep(1000); await A.evaluate(() => window.__tm.release('d')); await sleep(400);
  const ax = await A.evaluate(() => window.__tm.chars.omar.root.position.x);
  const bx = await B.evaluate(() => window.__tm.chars.omar.root.position.x);
  check(ax > -9.45 && Math.abs(ax - bx) < 0.3, `movement synced (Omar x local ${ax.toFixed(2)} / remote ${bx.toFixed(2)})`);
  // Shorok opens the toolbox
  await B.keyboard.press('t'); await sleep(500);
  await B.screenshot({ path: `${OUT}/03-toolbox.png` });
  await B.click('#tbUse'); await sleep(200);
  check(await B.evaluate(() => window.__tm.G.sel) === 'fake_spider', 'Shorok selected the Fake Spider from the toolbox');
  // Omar goes to the bathroom (unseen), Shorok sneaks to the desk
  await A.evaluate(() => window.__tm.teleport(4, 4)); await B.evaluate(() => { window.__tm.teleport(-9.0, -6.9); window.__tm.face('desk_pc'); }); await sleep(500);
  await B.evaluate(() => window.__tm.press('e')); await sleep(1200);
  await B.screenshot({ path: `${OUT}/04-preparing.png` });
  await sleep(1600); await B.evaluate(() => window.__tm.release('e')); await sleep(500);
  const traps = await B.evaluate(() => window.__tm.G.snap.you.traps.length);
  check(traps === 1, 'Fake Spider armed');
  // Omar comes back and uses the computer
  await A.evaluate(() => { window.__tm.teleport(-9.4, -6.8); window.__tm.face('desk_pc'); }); await B.evaluate(() => window.__tm.teleport(-6.0, -5.5)); await sleep(500);
  await A.evaluate(() => window.__tm.press('e')); await sleep(150); await A.evaluate(() => window.__tm.release('e'));
  await Promise.all([A, B].map(p => p.waitForFunction(() => !document.querySelector('#prankCard').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {})));
  check(await A.isVisible('#prankCard') && await B.isVisible('#prankCard'), 'prank card shown on BOTH screens');
  const sa = await A.evaluate(() => window.__tm.G.snap.players.shorok.score), sb = await B.evaluate(() => window.__tm.G.snap.players.shorok.score);
  check(sa === sb && sa >= 150, `scores synced (Shorok ${sa} on both)`);
  check(await A.evaluate(() => window.__tm.G.selfOverride?.anim) === 'scared', 'Omar plays the SCARED reaction');
  check(await B.evaluate(() => window.__tm.G.remoteOverride?.anim) === 'scared', 'Shorok sees Omar scared too');
  await A.screenshot({ path: `${OUT}/05-prank-omar-view.png` });
  await B.screenshot({ path: `${OUT}/06-prank-shorok-view.png` });

  await sleep(2600);
  // Revenge: Omar rigs the kitchen rocket while Shorok is in the bedroom, then she walks by
  await A.evaluate(() => { window.__tm.select('toy_rocket'); window.__tm.teleport(-1.3, -7.4); window.__tm.face('stove'); });
  await B.evaluate(() => window.__tm.teleport(-6, 4)); await sleep(400);
  await A.evaluate(() => window.__tm.press('e')); await sleep(4800); await A.evaluate(() => window.__tm.release('e')); await sleep(400);
  await A.evaluate(() => window.__tm.teleport(2.5, -3)); await sleep(300);
  await B.evaluate(() => window.__tm.teleport(-1.6, -7.2)); await sleep(1000);
  await A.screenshot({ path: `${OUT}/07-rocket-omar-view.png` });
  await B.screenshot({ path: `${OUT}/08-rocket-shorok-view.png` });
  const oa = await A.evaluate(() => window.__tm.G.snap.players.omar.score);
  check(oa >= 220, `Omar's revenge rocket landed (Omar ${oa})`);
  // pause sync
  await B.keyboard.press('Escape');
  await A.waitForFunction(() => !document.querySelector('#pause').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {});
  await A.screenshot({ path: `${OUT}/09-paused.png` });
  check(await A.isVisible('#pause'), 'pause shown for both');
  await A.click('#btnResume');
  await B.waitForFunction(() => document.querySelector('#pause').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {});
  check(!(await B.isVisible('#pause')), 'resume synced');
  console.log('page errors:', errors.length ? errors : 'none');
  check(errors.length === 0, 'no client errors');
} catch (e) { console.error(e); process.exitCode = 1; }
await browser.close(); srv.kill();
