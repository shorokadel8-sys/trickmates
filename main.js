// TRICKMATES — client boot, input, game loop, networking glue
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PRANK_BY_ID, HOTSPOTS, ROOMS, RULES, CHARACTERS, RISK, roomAt, other, dist } from '/shared/data.js';
import { World } from './world.js';
import { Character } from './characters.js';
import { FX, Sound } from './fx.js';
import { Net } from './net.js';
import * as UI from './ui.js';
const { $, $$ } = UI;

// ---------------- settings ----------------
const SETTINGS_KEY = 'tm_settings';
const settings = Object.assign({ volume: 0.7, sfx: true, quality: 'high', lang: 'both', zoom: 1 }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
const params = new URLSearchParams(location.search);
if (params.get('quality')) settings.quality = params.get('quality');
const DEBUG = params.get('debug') === '1';

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: settings.quality === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = settings.quality === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3b2e26);
scene.fog = new THREE.Fog(0x3b2e26, 30, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 16, 16);

scene.add(new THREE.HemisphereLight(0xfff0dc, 0x6b4e3a, 0.85));
const sun = new THREE.DirectionalLight(0xffd8a8, 1.9);
sun.position.set(-6, 16, 9); sun.target.position.set(0, 0, -1);
sun.castShadow = settings.quality === 'high';
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 45 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);

const world = new World(scene, settings.quality);
const chars = { omar: new Character('omar', scene), shorok: new Character('shorok', scene) };
const SPAWN = { omar: [-9.5, -4.2], shorok: [0.5, -6.2] };
for (const c of ['omar', 'shorok']) chars[c].root.position.set(SPAWN[c][0], 0, SPAWN[c][1]);
const sound = new Sound(); sound.volume = settings.volume; sound.enabled = settings.sfx;
const fx = new FX(scene, world, sound);
const labels = new UI.Labels(camera);
const net = new Net();

// ---------------- game state ----------------
const G = {
  me: null, code: null, host: null, inRoom: false, inGame: false,
  snap: null, phase: 'menu', paused: false,
  sel: null, tbFilter: 'all', tbView: 'fake_spider', toolboxOpen: false,
  action: null, stunUntil: 0, selfOverride: null, remoteOverride: null,
  remoteTarget: new THREE.Vector3(), remoteRot: 0, remoteAnim: 'idle',
  heading: Math.PI, moveTarget: null, lastSend: 0, shake: 0, speed01: 0,
  keys: new Set(), joy: { x: 0, y: 0, active: false }, run: false,
  createChar: 'omar', lastTick: 0,
};
const now = () => performance.now() / 1000;
const meChar = () => chars[G.me];
const themChar = () => chars[other(G.me)];

// ---------------- menus ----------------
UI.fillExpressionGallery();
$$('[data-go]').forEach(b => b.addEventListener('click', () => { sound.play('click'); go(b.dataset.go); }));
function go(id) {
  if (id === 'settings') { settingsReturn = G.inGame ? 'pause' : 'menu'; syncSettingsUI(); }
  if (id === 'join') setTimeout(() => $('#joinCode').focus(), 50);
  UI.showScreen(id);
}
let settingsReturn = 'menu';
$$('.char-card').forEach(c => c.addEventListener('click', () => {
  $$('.char-card').forEach(x => x.classList.toggle('selected', x === c)); G.createChar = c.dataset.char; sound.play('select');
}));
$('#btnCreate').onclick = async () => { sound.ensure(); await net.connect(); net.send({ type: 'create', char: G.createChar }); };
$('#btnJoin').onclick = async () => {
  const code = $('#joinCode').value.trim().toUpperCase();
  if (code.length !== 5) return UI.toast('The code has 5 characters.', 'warn');
  sound.ensure(); await net.connect(); net.send({ type: 'join', code });
};
$('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoin').click(); });
$('#btnCopyCode').onclick = () => copy(G.code, 'Code copied!');
$('#btnCopyLink').onclick = () => copy(`${location.origin}/?join=${G.code}`, 'Invite link copied!');
function copy(text, msg) { (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => UI.toast(msg, 'good')).catch(() => UI.toast(text)); }
$('#btnStart').onclick = () => net.send({ type: 'start' });
$('#btnLeaveLobby').onclick = () => leaveRoom();
function leaveRoom() { net.leave(); G.inRoom = false; exitGame(); UI.showScreen('menu'); }

// settings
function syncSettingsUI() {
  $('#setVolume').value = settings.volume; $('#setSfx').checked = settings.sfx; $('#setQuality').value = settings.quality;
  $('#setLang').value = settings.lang; $('#setZoom').value = settings.zoom;
}
$('#setVolume').oninput = e => { settings.volume = +e.target.value; sound.volume = settings.volume; sound.ensure(); saveSettings(); };
$('#setSfx').onchange = e => { settings.sfx = e.target.checked; sound.enabled = settings.sfx; saveSettings(); };
$('#setQuality').onchange = e => { settings.quality = e.target.value; saveSettings(); };
$('#setLang').onchange = e => { settings.lang = e.target.value; saveSettings(); };
$('#setZoom').oninput = e => { settings.zoom = +e.target.value; saveSettings(); };
$('#btnSettingsBack').onclick = () => { if (settingsReturn === 'pause') { UI.showScreen(null); $('#pause').classList.remove('hidden'); } else UI.showScreen('menu'); };

// net status
net.on('status', s => { const el = $('#connStatus'); el.textContent = s === 'online' ? '● connected' : s === 'connecting' ? 'connecting…' : '○ offline'; el.classList.toggle('online', s === 'online'); });
net.on('error', m => UI.toast(m.message, 'bad', null, 3500));
net.on('resume_failed', () => { G.inRoom = false; exitGame(); UI.showScreen('menu'); });

net.on('joined', m => {
  G.me = m.you; G.code = m.code; G.host = m.host; G.inRoom = true;
  $('#lobbyCode').textContent = m.code;
  try { history.replaceState(null, '', location.pathname + (DEBUG ? '?debug=1' : '')); } catch {}
});
net.on('lobby', m => {
  G.host = m.host;
  for (const c of ['omar', 'shorok']) {
    const s = $('#slot-' + c); const p = m.players[c];
    s.classList.toggle('on', p.connected); s.classList.toggle('you', c === G.me);
    s.querySelector('.status').textContent = p.connected ? 'ready!' : p.taken ? 'reconnecting…' : 'waiting…';
  }
  const both = m.players.omar.connected && m.players.shorok.connected;
  const isHost = G.host === G.me;
  $('#btnStart').disabled = !both || !isHost;
  $('#btnStart').textContent = isHost ? 'Start Match' : 'Waiting for host…';
  $('#lobbyHint').textContent = both ? (isHost ? 'Both players are here — start when ready!' : `Waiting for ${CHARACTERS[G.host].name} to start…`) : 'Send the code to your partner. The match starts when both are here.';
  if (m.phase === 'lobby' && !G.inGame) UI.showScreen('lobby');
});

// ---------------- entering / leaving the game ----------------
function enterGame() {
  if (G.inGame) return;
  G.inGame = true;
  UI.showScreen(null);
  $('#hud').classList.remove('hidden');
  $('#results').classList.add('hidden');
}
function exitGame() {
  G.inGame = false; G.snap = null; G.action = null; G.sel = null;
  $('#hud').classList.add('hidden'); ['#toolbox', '#pause', '#intermission', '#results', '#prankCard'].forEach(s => $(s).classList.add('hidden'));
  labels.clear(); hideProgress();
}

// ---------------- server events ----------------
net.on('state', m => {
  const prevPhase = G.snap?.phase;
  G.snap = m;
  if (!G.inGame && (m.phase === 'playing' || m.phase === 'intermission')) enterGame();
  if (m.phase === 'results' && !G.inGame) enterGame();
  const them = m.players[other(G.me)];
  G.remoteTarget.set(them.x, 0, them.z); G.remoteRot = them.r; G.remoteAnim = them.a;
  if (prevPhase !== m.phase && m.phase === 'playing') $('#intermission').classList.add('hidden');
  setPaused(m.paused, m.pauseReason, m.forfeitIn);
  if (!G.firstState) { G.firstState = true; const me = m.players[G.me]; meChar().root.position.set(me.x, 0, me.z); }
  for (const c of ['omar', 'shorok']) chars[c].setEmotion(m.players[c].emotion);
});
net.on('correct', m => { meChar().root.position.set(m.x, 0, m.z); G.moveTarget = null; });

net.on('ev:round', m => {
  enterGame();
  $('#intermission').classList.add('hidden'); $('#results').classList.add('hidden');
  for (const c of ['omar', 'shorok']) { chars[c].root.position.set(m.spawn[c].x, 0, m.spawn[c].z); chars[c].setAnim('idle'); }
  G.remoteTarget.set(m.spawn[other(G.me)].x, 0, m.spawn[other(G.me)].z);
  G.heading = Math.PI; G.action = null; G.sel = null; G.stunUntil = 0; G.moveTarget = null; hideProgress();
  sound.play('round');
  UI.toast(`Round ${m.round} of ${m.rounds} — let the pranks begin!`, 'good', null, 3000);
  if (m.round === 1) setTimeout(() => UI.toast('Open the Toolbox (T) and pick your first prank 🧰'), 1500);
});
net.on('ev:round_end', m => {
  $('#interTitle').textContent = `Round ${m.round} complete!`;
  $('#interScores').innerHTML = `<span style="color:var(--omar)">Omar ${m.scores.omar}</span><span style="color:var(--shorok)">Shorok ${m.scores.shorok}</span>`;
  $('#intermission').classList.remove('hidden'); G.action = null; G.sel = null; hideProgress(); closeToolbox();
  sound.play('success');
});
net.on('ev:results', m => {
  enterGame(); closeToolbox(); hideProgress(); G.action = null;
  $('#intermission').classList.add('hidden'); $('#pause').classList.add('hidden');
  UI.showResults(m, G.me);
  if (m.winner !== 'tie') { chars[m.winner].setAnim('victory'); chars[other(m.winner)].setAnim('sad'); G.selfOverride = { anim: m.winner === G.me ? 'victory' : 'sad', until: now() + 999 }; G.remoteOverride = { anim: m.winner === G.me ? 'sad' : 'victory', until: now() + 999 }; }
  sound.play(m.winner === G.me || m.winner === 'tie' ? 'victory' : 'fail');
});
net.on('ev:rematch_req', m => {
  $('#rematchInfo').textContent = m.char === G.me ? `Waiting for ${CHARACTERS[other(G.me)].name} to accept…` : `${CHARACTERS[m.char].name} wants a rematch!`;
  if (m.char === G.me) { $('#btnRematch').disabled = true; $('#btnRematch').textContent = 'Rematch requested'; }
});
net.on('ev:pause', m => { if (m.on) sound.play('click'); });
net.on('ev:toast', m => { UI.toast(m.text, m.kind); if (m.kind === 'warn' && G.action?.kind === 'prep') cancelAction(false); });
net.on('ev:score', m => { if (m.char === G.me) UI.toast(m.why, m.pts >= 0 ? 'good' : 'bad', m.pts); });

const REACT_ANIM = { scared: 'scared', surprised: 'surprised', angry: 'angry', embarrassed: 'embarrassed', sad: 'sad' };
net.on('ev:prank', m => {
  const pr = PRANK_BY_ID[m.prank];
  const victim = chars[m.victim], owner = chars[m.owner];
  if (m.victim !== G.me) G.remoteTarget.set(m.vx, 0, m.vz);
  fx.play(pr, m.hs, victim);
  const ranim = REACT_ANIM[pr.react] || 'surprised';
  const until = now() + RULES.stunSeconds;
  if (m.victim === G.me) { G.stunUntil = until; G.selfOverride = { anim: ranim, until }; cancelAction(false); G.shake = 0.5; G.moveTarget = null; }
  else G.remoteOverride = { anim: ranim, until };
  setTimeout(() => {
    if (m.owner === G.me) G.selfOverride = { anim: 'laugh', until: now() + 2 }; else G.remoteOverride = { anim: 'laugh', until: now() + 2 };
    sound.play('laugh');
  }, 900);
  labels.bubble(m.victim, UI.lineHTML(m.line, settings.lang), 3200);
  UI.showPrankCard(pr, m.owner, m.victim, settings.lang);
  if (m.owner === G.me) { UI.toast(`${pr.icon} ${pr.name} landed!`, 'good', m.points); sound.play('success'); }
  else UI.toast(`${CHARACTERS[m.owner].name} got you with ${pr.name}!`, 'bad');
});
net.on('ev:armed', m => {
  const pr = PRANK_BY_ID[m.prank];
  fx.armed(m.hs); sound.play('select');
  UI.toast(`${pr.icon} ${pr.name} is armed${pr.trigger === 'remote' ? ' — press Activate when they\'re close' : ''}`, 'good');
  if (G.sel === m.prank) G.sel = null;
});
net.on('ev:caught', m => {
  fx.caught(chars[m.who].root.position);
  sound.play('caught');
  labels.bubble(m.by, UI.lineHTML(m.line, settings.lang), 3000);
  if (m.who === G.me) { cancelAction(false); G.selfOverride = { anim: 'embarrassed', until: now() + 2 }; UI.toast(`Caught by ${CHARACTERS[m.by].name}!`, 'bad', RULES.points.caughtPenalty); }
  else { G.remoteOverride = { anim: 'embarrassed', until: now() + 2 }; G.selfOverride = { anim: 'angry', until: now() + 1.5 }; UI.toast(`You caught ${CHARACTERS[m.who].name} red-handed!`, 'good', RULES.points.catchReward); }
});
net.on('ev:defused', m => {
  fx.defused(m.hs); sound.play(m.by === G.me ? 'success' : 'fail');
  const pr = PRANK_BY_ID[m.prank];
  labels.bubble(m.by, UI.lineHTML(['مش هتعرف تضحك عليّا!', 'Nice try!'], settings.lang), 2500);
  if (m.by === G.me) UI.toast(`Found and defused ${pr.icon} ${pr.name}!`, 'good', RULES.points.defuseReward);
  else UI.toast(`${CHARACTERS[m.by].name} found your ${pr.name}!`, 'bad', RULES.points.discoveredPenalty);
});
net.on('ev:search_empty', () => { UI.toast('Nothing suspicious here…'); });
net.on('ev:miss', m => { if (m.char === G.me) sound.play('fail'); });
net.on('ev:chore', m => { if (m.char === G.me) sound.play('select'); });
net.on('ev:challenge', m => { UI.toast(`🏆 Challenge: ${m.name}${m.char === G.me ? '' : ` (${CHARACTERS[m.char].name})`}`, m.char === G.me ? 'good' : 'info', m.char === G.me ? m.bonus : null, 3500); if (m.char === G.me) sound.play('victory'); });
net.on('ev:lure', m => { sound.play('ring'); UI.toast(`🔔 Ding-dong! Something in the ${ROOMS[m.room].name} — check it within ${m.secs}s for +${RULES.points.lure}`, 'info', null, 4000); });
net.on('ev:lure_end', m => { if (!m.ok) UI.toast('The doorbell stopped ringing.'); });
net.on('ev:distract_ok', m => UI.toast(`🔔 Fake doorbell ringing in the ${ROOMS[m.room].name}… sneak time!`, 'good'));
net.on('ev:emote', m => {
  fx.emote(chars[m.char], m.e);
  const anim = { laughing: 'laugh', angry: 'angry', sad: 'sad', embarrassed: 'embarrassed', happy: 'victory' }[m.e] || 'idle';
  if (m.char === G.me) G.selfOverride = { anim, until: now() + 1.6 }; else G.remoteOverride = { anim, until: now() + 1.6 };
});

function setPaused(on, reason, forfeitIn) {
  G.paused = on;
  if (!G.inGame || G.snap?.phase === 'results') return;
  $('#pause').classList.toggle('hidden', !on);
  if (on) {
    const dc = reason === 'disconnect';
    $('#pauseTitle').textContent = dc ? 'Partner disconnected' : 'Paused';
    $('#pauseInfo').textContent = dc ? `Waiting for them to reconnect… ${Math.ceil(forfeitIn || 0)}s (then you win by forfeit)` : `${reason || 'Paused'} — the match is paused for both players.`;
    $('#btnResume').disabled = dc;
    cancelAction(true);
  }
}
$('#btnPause').onclick = () => net.send({ type: 'pause', on: true });
$('#btnResume').onclick = () => net.send({ type: 'pause', on: false });
$('#btnPauseSettings').onclick = () => { $('#pause').classList.add('hidden'); go('settings'); };
$('#btnQuit').onclick = () => leaveRoom();
$('#btnRematch').onclick = () => net.send({ type: 'rematch' });
$('#btnMenu').onclick = () => leaveRoom();

// ---------------- toolbox ----------------
function openToolbox() {
  if (!G.inGame || G.snap?.phase !== 'playing') return;
  G.toolboxOpen = true; $('#toolbox').classList.remove('hidden'); renderTB(); sound.play('click');
}
function closeToolbox() { G.toolboxOpen = false; $('#toolbox').classList.add('hidden'); }
function renderTB(force = true) {
  if (!G.toolboxOpen || !G.snap) return;
  const y = G.snap.you;
  const sig = JSON.stringify([G.tbFilter, G.tbView, y.used, y.traps.map(t => t.prank), settings.lang]);
  if (!force && sig === G.tbSig) return;
  G.tbSig = sig;
  G.tbView = UI.renderToolbox({
    filter: G.tbFilter, view: G.tbView, used: y.used, armedIds: y.traps.map(t => t.prank), armedCount: y.traps.length, me: G.me, lang: settings.lang,
    onFilter: f => { G.tbFilter = f; sound.play('click'); renderTB(); },
    onView: id => { G.tbView = id; sound.play('click'); renderTB(); },
    onUse: id => {
      G.sel = id; closeToolbox(); sound.play('select');
      const pr = PRANK_BY_ID[id];
      UI.toast(`${pr.icon} ${pr.item} in hand — go to the ${HOTSPOTS[pr.hotspot].label} (${ROOMS[pr.room].name}) and hold E`, 'info', null, 3500);
    },
  });
}
$('#btnToolbox').onclick = () => G.toolboxOpen ? closeToolbox() : openToolbox();
$('#tbClose').onclick = closeToolbox;
$('#trapList').addEventListener('click', e => { const id = e.target.dataset?.activate; if (id) { net.send({ type: 'activate', trap: id }); sound.play('click'); } });
// emotes + distract
$('#btnEmote').onclick = () => { $('#emoteMenu').classList.toggle('hidden'); $('#distractMenu').classList.add('hidden'); };
$$('#emoteMenu button').forEach(b => b.onclick = () => { net.send({ type: 'emote', e: b.dataset.emote }); $('#emoteMenu').classList.add('hidden'); });
const dm = $('#distractMenu');
for (const r of Object.values(ROOMS)) { const b = document.createElement('button'); b.textContent = '🔔 ' + r.name; b.onclick = () => { net.send({ type: 'distract', room: r.id }); dm.classList.add('hidden'); }; dm.appendChild(b); }
$('#btnDistract').onclick = () => openDistract();
function openDistract() { if (G.snap?.you.distractIn > 0) return UI.toast(`Distraction recharging (${Math.ceil(G.snap.you.distractIn)}s)`, 'warn'); dm.classList.toggle('hidden'); $('#emoteMenu').classList.add('hidden'); }

// ---------------- actions (hold E / F) ----------------
function canAct() { return G.inGame && G.snap?.phase === 'playing' && !G.paused && now() > G.stunUntil && !G.action; }
function focusHotspot() {
  if (!G.me) return null;
  // nearest hotspot in range, weighted by where the character is facing
  const p = meChar().root.position, hx = Math.sin(G.heading), hz = Math.cos(G.heading);
  let best = null, bs = Infinity;
  for (const [id, h] of Object.entries(HOTSPOTS)) {
    const dx = h.pos[0] - p.x, dz = h.pos[1] - p.z, d = Math.hypot(dx, dz);
    if (d >= RULES.interactRadius) continue;
    const facing = d > 0.05 ? (dx * hx + dz * hz) / d : 1;
    const score = d + (1 - facing) * 0.8;
    if (score < bs) { bs = score; best = id; }
  }
  // prefer the selected prank's target if it is in range
  if (G.sel) { const t = PRANK_BY_ID[G.sel].hotspot, h = HOTSPOTS[t]; if (dist(p.x, p.z, h.pos[0], h.pos[1]) < RULES.interactRadius) return t; }
  return best;
}
function startPrimary() {
  if (!canAct()) return;
  const hs = focusHotspot(); if (!hs) return;
  G.moveTarget = null;
  const y = G.snap.you;
  if (G.sel && PRANK_BY_ID[G.sel].hotspot === hs) {
    const pr = PRANK_BY_ID[G.sel];
    if (y.used.includes(pr.id)) { G.sel = null; return UI.toast('Already used this round.', 'warn'); }
    net.send({ type: 'prep_start', prank: pr.id });
    G.action = { kind: 'prep', hs, prank: pr.id, t: now(), dur: pr.prep, label: `Preparing ${pr.name}…` };
    sound.play('rustle');
  } else {
    net.send({ type: 'interact', hs });
    const isChore = y.chores.includes(hs);
    G.action = { kind: isChore ? 'chore' : 'use', hs, t: now(), dur: isChore ? RULES.choreSeconds : 0.9, label: isChore ? HOTSPOTS[hs].chore + '…' : `Using ${HOTSPOTS[hs].label}…` };
  }
  faceHotspot(hs);
}
function startSearch() {
  if (!canAct()) return;
  const hs = focusHotspot(); if (!hs) return;
  G.moveTarget = null;
  G.action = { kind: 'search', hs, t: now(), dur: RULES.searchSeconds, label: `Searching the ${HOTSPOTS[hs].label}…` };
  faceHotspot(hs);
}
function faceHotspot(hs) { const p = meChar().root.position, h = HOTSPOTS[hs].pos; G.heading = Math.atan2(h[0] - p.x, h[1] - p.z); }
function releaseKey(kind) {
  if (!G.action) return;
  if ((kind === 'E' && (G.action.kind === 'prep' || G.action.kind === 'chore')) || (kind === 'F' && G.action.kind === 'search')) {
    if (now() - G.action.t >= G.action.dur * 0.97) completeAction(); else cancelAction(true);
  }
}
function cancelAction(notify) {
  if (G.action?.kind === 'prep' && notify) net.send({ type: 'prep_cancel' });
  G.action = null; hideProgress();
}
function completeAction() {
  const a = G.action; G.action = null; hideProgress();
  if (a.kind === 'prep') net.send({ type: 'prep_done' });
  else if (a.kind === 'chore') net.send({ type: 'chore_done', hs: a.hs });
  else if (a.kind === 'search') net.send({ type: 'search', hs: a.hs });
}
function showProgress(k, label) { const el = $('#progress'); el.classList.remove('hidden'); el.firstElementChild.style.width = (k * 100) + '%'; el.lastElementChild.textContent = label; }
function hideProgress() { $('#progress').classList.add('hidden'); }

// ---------------- input ----------------
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  G.keys.add(k); if (e.key === 'Shift') G.run = true;
  if (!G.inGame || e.repeat) return;
  if (k === 'e') startPrimary();
  else if (k === 'f') startSearch();
  else if (k === 't' || k === 'tab') { e.preventDefault(); G.toolboxOpen ? closeToolbox() : openToolbox(); }
  else if (k === 'q') openDistract();
  else if (k === 'escape') { if (G.toolboxOpen) closeToolbox(); else if (G.snap?.phase !== 'results') net.send({ type: 'pause', on: !G.paused }); }
  else if ('1234'.includes(k)) net.send({ type: 'emote', e: ['laughing', 'angry', 'sneaky', 'happy'][+k - 1] });
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase(); G.keys.delete(k); if (e.key === 'Shift') G.run = false;
  if (k === 'e') releaseKey('E'); if (k === 'f') releaseKey('F');
});
addEventListener('blur', () => { G.keys.clear(); G.run = false; });
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  if (!G.inGame || e.button !== 0 || e.pointerType === 'touch') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(groundPlane, hit)) G.moveTarget = hit;
});
addEventListener('wheel', e => { if (!G.inGame) return; settings.zoom = Math.max(0.6, Math.min(1.5, settings.zoom + Math.sign(e.deltaY) * 0.05)); }, { passive: true });
// touch joystick + buttons
(() => {
  const joy = $('#joy'), knob = $('#joyKnob'); let id = null, cx = 0, cy = 0;
  joy.addEventListener('pointerdown', e => { id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(id); G.joy.active = true; });
  joy.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy), m = 50;
    if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px, ${dy}px)`; G.joy.x = dx / m; G.joy.y = dy / m;
  });
  const end = () => { id = null; G.joy = { x: 0, y: 0, active: false }; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (el, down, up) => { el.addEventListener('pointerdown', e => { e.preventDefault(); down(); }); el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); };
  hold($('#tE'), startPrimary, () => releaseKey('E'));
  hold($('#tF'), startSearch, () => releaseKey('F'));
  hold($('#tRun'), () => G.run = true, () => G.run = false);
})();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------- per-frame ----------------
const tmpV = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 16, 16), camLook = new THREE.Vector3(0, 0, -1);
let last = performance.now(), hudT = 0, menuT = 0;

function stepLocal(dt) {
  const me = meChar(), p = me.root.position;
  const t = now();
  const stunned = t < G.stunUntil;
  const blocked = stunned || G.paused || G.action || G.snap?.phase === 'results';
  let ix = 0, iz = 0;
  if (!blocked) {
    const K = G.keys;
    if (K.has('w') || K.has('arrowup')) iz -= 1; if (K.has('s') || K.has('arrowdown')) iz += 1;
    if (K.has('a') || K.has('arrowleft')) ix -= 1; if (K.has('d') || K.has('arrowright')) ix += 1;
    if (G.joy.active) { ix += G.joy.x; iz += G.joy.y; }
    if (ix || iz) G.moveTarget = null;
    else if (G.moveTarget) { const dx = G.moveTarget.x - p.x, dz = G.moveTarget.z - p.z, d = Math.hypot(dx, dz); if (d < 0.15) G.moveTarget = null; else { ix = dx / d; iz = dz / d; } }
  }
  const len = Math.hypot(ix, iz);
  let moving = false;
  if (len > 0.1) {
    const running = G.run || (G.joy.active && len > 0.95);
    const sp = (running ? RULES.runSpeed : RULES.walkSpeed) * Math.min(1, len);
    const nx = p.x + ix / len * sp * dt, nz = p.z + iz / len * sp * dt;
    const [cx, cz] = world.collide(nx, nz, 0.33);
    if (G.moveTarget && Math.hypot(cx - p.x, cz - p.z) < sp * dt * 0.2) G.moveTarget = null; // stuck
    p.x = cx; p.z = cz; moving = true;
    G.heading = Math.atan2(ix, iz);
    G.speed01 = running ? 1 : 0.5;
  } else G.speed01 = 0;
  // rotation smoothing
  let dr = G.heading - me.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  me.root.rotation.y += dr * Math.min(1, dt * 12);
  // anim selection
  let anim = 'idle';
  if (G.selfOverride && t < G.selfOverride.until) anim = G.selfOverride.anim;
  else if (G.action) anim = G.action.kind === 'prep' ? 'prepare' : G.action.kind === 'search' ? 'search' : 'interact';
  else if (moving) anim = G.speed01 > 0.7 ? 'run' : 'walk';
  me.setAnim(anim);
  // action progress
  if (G.action) {
    const k = (t - G.action.t) / G.action.dur;
    if (G.action.kind !== 'use') showProgress(Math.min(1, k), G.action.label);
    if (k >= 1) { if (G.action.kind === 'use') { G.action = null; } else completeAction(); }
  }
  // send position (15 Hz)
  if (t - G.lastSend > 1 / 15) { G.lastSend = t; net.send({ type: 'pos', x: +p.x.toFixed(3), z: +p.z.toFixed(3), r: +me.root.rotation.y.toFixed(3), a: anim }); }
}

function stepRemote(dt) {
  const them = themChar(), p = them.root.position;
  const d = p.distanceTo(G.remoteTarget);
  if (d > 4) p.copy(G.remoteTarget); else p.lerp(G.remoteTarget, Math.min(1, dt * 10));
  let dr = G.remoteRot - them.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  them.root.rotation.y += dr * Math.min(1, dt * 10);
  const anim = (G.remoteOverride && now() < G.remoteOverride.until) ? G.remoteOverride.anim : G.remoteAnim;
  them.setAnim(anim || 'idle');
}

function updateWorldHints() {
  const p = meChar().root.position, y = G.snap?.you;
  const ring = fx.ensureRing(), arrow = fx.ensureArrow();
  const hs = (!G.action && G.snap?.phase === 'playing') ? focusHotspot() : null;
  const prompt = $('#prompt');
  if (hs) {
    const h = HOTSPOTS[hs]; ring.visible = true; ring.position.set(h.pos[0], 0.03, h.pos[1]);
    let txt;
    if (G.sel && PRANK_BY_ID[G.sel].hotspot === hs) txt = `Hold <kbd>E</kbd> to prepare <b>${PRANK_BY_ID[G.sel].name}</b> · <kbd>F</kbd> search`;
    else if (y?.chores.includes(hs)) txt = `Hold <kbd>E</kbd> ${h.chore} (+${RULES.points.chore}) · <kbd>F</kbd> search`;
    else txt = `<kbd>E</kbd> use ${h.label} · Hold <kbd>F</kbd> to search for pranks`;
    if (y?.traps.some(t => t.hs === hs)) txt = `Your prank is hidden here 🤫`;
    if (prompt._h !== txt) { prompt.innerHTML = txt; prompt._h = txt; }
    prompt.classList.remove('hidden');
  } else { ring.visible = false; prompt.classList.add('hidden'); }
  // arrow to selected prank target
  if (G.sel && G.snap?.phase === 'playing') { const h = HOTSPOTS[PRANK_BY_ID[G.sel].hotspot]; arrow.visible = true; arrow.position.x = h.pos[0]; arrow.position.z = h.pos[1]; fx.arrowY = 2.2; }
  else arrow.visible = false;
  // glints (tells for medium/high risk enemy pranks)
  const tells = new Map((y?.tells || []).map(t => [t.hs, t.r]));
  for (const id of Object.keys(HOTSPOTS)) { const r = tells.get(id); const h = HOTSPOTS[id]; fx.setGlint(id, !!r && dist(p.x, p.z, h.pos[0], h.pos[1]) <= r); }
  // risk meter
  const them = themChar().root.position;
  const sameRoom = roomAt(p.x, p.z) && roomAt(p.x, p.z) === roomAt(them.x, them.z);
  let risk = 0, label = 'Safe';
  const d = dist(p.x, p.z, them.x, them.z);
  if (G.action?.kind === 'prep') {
    const cr = RISK[PRANK_BY_ID[G.action.prank].risk].catchRadius;
    risk = sameRoom ? Math.min(1, cr / Math.max(0.1, d)) * 0.95 : 0.05;
  } else if (G.sel) {
    const cr = RISK[PRANK_BY_ID[G.sel].risk].catchRadius;
    risk = sameRoom ? Math.min(1, cr / Math.max(0.1, d)) * 0.8 : 0.05;
  } else risk = sameRoom ? Math.max(0, 1 - d / 9) * 0.6 : 0;
  label = risk > 0.75 ? 'DANGER' : risk > 0.45 ? 'Risky' : risk > 0.15 ? 'Careful' : 'Safe';
  const fill = $('#riskFill'); fill.style.width = (risk * 100) + '%'; fill.style.background = risk > 0.75 ? 'var(--bad)' : risk > 0.45 ? 'var(--gold)' : 'var(--good)';
  $('#riskLabel').textContent = label;
}

function updateCamera(dt) {
  const z = settings.zoom;
  if (G.closeup) {
    const c = chars[G.closeup].root.position;
    camera.position.set(c.x + 0.25, 1.95, c.z + 1.7); camera.lookAt(c.x + 0.05, 1.7, c.z); return;
  }
  if (G.inGame && G.me) {
    const p = meChar().root.position;
    tmpV.set(p.x, 0, p.z + 0.4);
    camLook.lerp(tmpV, Math.min(1, dt * 6));
    camPos.set(camLook.x, 8.2 * z, camLook.z + 7.4 * z);
  } else {
    menuT += dt * 0.08;
    camLook.set(Math.sin(menuT) * 4, 0, -1);
    camPos.set(Math.sin(menuT) * 10, 17, 15 + Math.cos(menuT) * 2);
  }
  camera.position.lerp(camPos, Math.min(1, dt * 5));
  if (G.shake > 0) { G.shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.25 * G.shake; camera.position.y += (Math.random() - 0.5) * 0.25 * G.shake; }
  camera.lookAt(camLook.x, 0.6, camLook.z - 0.3);
}

function frame() {
  requestAnimationFrame(frame);
  const tnow = performance.now(); const dt = Math.min(0.1, (tnow - last) / 1000); last = tnow;
  const t = tnow / 1000;
  if (G.inGame && G.me && G.snap) {
    if (G.snap.phase !== 'lobby') { stepLocal(dt); stepRemote(dt); }
    updateWorldHints();
    hudT += dt;
    if (hudT > 0.1) {
      hudT = 0;
      const p = meChar().root.position;
      UI.updateHud(G.snap, G.me, roomAt(p.x, p.z), G.sel);
      if (G.toolboxOpen) renderTB(false);
      if (G.paused && G.snap.pauseReason === 'disconnect') $('#pauseInfo').textContent = `Waiting for them to reconnect… ${Math.ceil(G.snap.forfeitIn)}s (then you win by forfeit)`;
    }
  } else {
    // menu idle: characters chill in the house
    chars.omar.setAnim('idle'); chars.shorok.setAnim('idle');
  }
  for (const c of ['omar', 'shorok']) chars[c].update(dt);
  const remotePrep = G.snap && G.me ? (G.snap.players[other(G.me)].preparing ? '🤫' : G.snap.players[other(G.me)].connected ? '' : '📴') : '';
  labels.update(chars, G.inGame && !!G.snap, G.me ? { [other(G.me)]: remotePrep } : {});
  fx.update(dt, t);
  // pendant lights would block the close gameplay camera — show them only in the menu fly-over
  const showCeiling = !G.inGame || !!G.closeup;
  if (world.ceiling[0].visible !== showCeiling) world.ceiling.forEach(m => m.visible = showCeiling);
  // TV idle animation
  if (Math.floor(t * 4) !== Math.floor((t - dt) * 4) && !fx.items.length) world.fx.tv.redraw(t);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---------------- boot ----------------
(async function boot() {
  const join = params.get('join');
  if (join) { $('#joinCode').value = join.toUpperCase().slice(0, 5); }
  if (net.hasSession()) { await net.resume(); }
  else if (join) UI.showScreen('join');
  frame();
})();

// debug/test hooks (?debug=1)
if (DEBUG) {
  window.__tm = {
    G, chars, net, world, fx,
    teleport(x, z) { const p = meChar().root.position; p.set(x, 0, z); G.moveTarget = null; net.send({ type: 'pos', x, z, r: 0, a: 'idle' }); },
    face(hs) { faceHotspot(hs); },
    press(k) { dispatchEvent(new KeyboardEvent('keydown', { key: k })); },
    release(k) { dispatchEvent(new KeyboardEvent('keyup', { key: k })); },
    select(id) { G.sel = id; },
    closeup(c) { G.closeup = c; },
  };
}
