// TRICKMATES — DOM UI helpers (menus, HUD, toolbox, toasts, bubbles, results)
import * as THREE from 'three';
import { PRANKS, PRANK_BY_ID, HOTSPOTS, ROOMS, CATEGORIES, RISK, TRIGGERS, CHALLENGES, CHARACTERS, RULES, other } from '/shared/data.js';

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];

const PORTRAITS = {
  omar: { happy: 'happy', angry: 'angry', sad: 'sad', surprised: 'surprised', scared: 'scared', sneaky: 'sneaky', laughing: 'happy', embarrassed: 'scared', neutral: 'happy' },
  shorok: { happy: 'happy', angry: 'angry', sad: 'sad', surprised: 'surprised', scared: 'scared', sneaky: 'sneaky', laughing: 'laughing', embarrassed: 'embarrassed', neutral: 'happy', worried: 'worried' },
};
export const portrait = (c, e) => `/assets/ref/${c}_${PORTRAITS[c][e] || 'happy'}.jpg`;
export const EXPRESSIONS = {
  omar: ['happy', 'angry', 'sad', 'surprised', 'scared', 'sneaky'],
  shorok: ['happy', 'laughing', 'angry', 'worried', 'embarrassed', 'sad', 'surprised', 'scared', 'sneaky'],
};

export function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

export function toast(text, kind = 'info', pts = null, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = text + (pts != null ? `<span class="pts">${pts > 0 ? '+' : ''}${pts}</span>` : '');
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  setTimeout(() => el.remove(), ms);
}

export const fmtTime = (s) => { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const hsWhere = (hs) => `${HOTSPOTS[hs].label} · ${ROOMS[HOTSPOTS[hs].room].name}`;
export const lineHTML = (line, lang) => {
  const [ar, en] = line;
  if (lang === 'ar') return `<span class="ar">${ar}</span>`;
  if (lang === 'en') return `“${en}”`;
  return `<span class="ar">${ar}</span>“${en}”`;
};

// ---------- name tags + speech bubbles ----------
export class Labels {
  constructor(camera) {
    this.camera = camera; this.root = $('#labels'); this.tags = {}; this.bubbles = [];
    this.v = new THREE.Vector3();
  }
  ensureTag(char) {
    if (!this.tags[char]) { const el = document.createElement('div'); el.className = 'nametag ' + char; this.root.appendChild(el); this.tags[char] = el; }
    return this.tags[char];
  }
  bubble(char, html, ms = 3000) {
    this.bubbles = this.bubbles.filter(b => { if (b.char === char) { b.el.remove(); return false; } return true; });
    const el = document.createElement('div'); el.className = 'bubble'; el.innerHTML = html; this.root.appendChild(el);
    this.bubbles.push({ char, el, until: performance.now() + ms });
  }
  project(pos) {
    this.v.copy(pos).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * innerWidth, y: (-this.v.y * 0.5 + 0.5) * innerHeight, vis: this.v.z < 1 };
  }
  update(chars, visible, extra = {}) {
    const now = performance.now();
    for (const c of ['omar', 'shorok']) {
      const tag = this.ensureTag(c);
      tag.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const h = chars[c].headWorld(); h.y += 0.42;
      const p = this.project(h);
      tag.style.left = p.x + 'px'; tag.style.top = p.y + 'px';
      const label = CHARACTERS[c].name + (extra[c] ? `<span class="tag-state">${extra[c]}</span>` : '');
      if (tag._l !== label) { tag.innerHTML = label; tag._l = label; }
    }
    this.bubbles = this.bubbles.filter(b => {
      if (now > b.until || !visible) { b.el.remove(); return false; }
      const h = chars[b.char].headWorld(); h.y += 0.75;
      const p = this.project(h); b.el.style.left = p.x + 'px'; b.el.style.top = p.y + 'px';
      return true;
    });
  }
  clear() { this.bubbles.forEach(b => b.el.remove()); this.bubbles = []; }
}

// ---------- HUD ----------
let lastPortrait = {};
export function updateHud(snap, me, localRoom, selected) {
  for (const c of ['omar', 'shorok']) {
    const p = snap.players[c], card = $('#card-' + c);
    card.querySelector('.score').textContent = p.score;
    card.classList.toggle('off', !p.connected);
    card.classList.toggle('me', c === me);
    const src = portrait(c, p.emotion);
    if (lastPortrait[c] !== src) {
      card.querySelector('img').src = src; lastPortrait[c] = src;
      card.classList.add('bump'); setTimeout(() => card.classList.remove('bump'), 220);
    }
  }
  $('#roundLabel').textContent = snap.phase === 'intermission' ? 'Next round in' : `Round ${snap.round}/${snap.rounds}`;
  $('#timer').textContent = fmtTime(snap.timeLeft);
  $('.timer-pill').classList.toggle('low', snap.phase === 'playing' && snap.timeLeft < 20);
  $('#roomName').textContent = localRoom ? ROOMS[localRoom].name : 'Hallway';
  const y = snap.you;
  setList('#choreList', y.chores.map(hs => `<li><span>${HOTSPOTS[hs].chore}</span><span class="where">${ROOMS[HOTSPOTS[hs].room].name}</span></li>`).join(''));
  setList('#challengeList', CHALLENGES.map(ch => `<li class="${y.challenges.includes(ch.id) ? 'done' : ''}" title="${ch.desc}"><span>${ch.name}</span><span class="where">+${ch.bonus}</span></li>`).join(''));
  $('#armedCount').textContent = `${y.traps.length}/${RULES.maxArmedTraps}`;
  setList('#trapList', y.traps.length ? y.traps.map(t => {
    const pr = PRANK_BY_ID[t.prank];
    const act = pr.trigger === 'remote' ? `<button data-activate="${t.id}">Activate</button>` : `<span class="where">${pr.trigger === 'proximity' ? 'on approach' : 'on use'}</span>`;
    return `<li><span>${pr.icon} ${pr.name}<br><span class="where">${HOTSPOTS[t.hs].label}</span></span>${act}</li>`;
  }).join('') : '<li class="muted">None yet — open the Toolbox</li>');
  const cd = Math.ceil(y.distractIn);
  $('#distractCd').textContent = cd > 0 ? cd : '';
  const lb = $('#lureBox');
  if (y.lure) { lb.hidden = false; lb.innerHTML = `<h4>🔔 Doorbell!</h4>Go to the <b>${ROOMS[y.lure.room].name}</b> (+${RULES.points.lure}) · ${Math.ceil(y.lure.left)}s`; }
  else lb.hidden = true;
  const sb = $('#selectedBox');
  if (selected) {
    const pr = PRANK_BY_ID[selected]; sb.hidden = false;
    $('#selectedPrank').innerHTML = `${pr.icon} <b>${pr.name}</b><br><span class="where">Go to: ${hsWhere(pr.hotspot)} · hold <kbd>E</kbd></span>`;
  } else sb.hidden = true;
}
function setList(sel, html) { const el = $(sel); if (el._h !== html) { el.innerHTML = html; el._h = html; } }

// ---------- toolbox ----------
export function renderToolbox(ctx) {
  const { filter, view, used, armedIds, armedCount, me, onFilter, onView, onUse, lang } = ctx;
  const tabs = $('#tbTabs');
  tabs.innerHTML = CATEGORIES.map(c => `<button class="${c === filter ? 'on' : ''}" data-cat="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join('')
    + Object.values(ROOMS).filter(r => !CATEGORIES.includes(r.id)).map(r => `<button class="${r.id === filter ? 'on' : ''}" data-cat="${r.id}">${r.name}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => onFilter(b.dataset.cat));
  const list = PRANKS.filter(p => filter === 'all' || p.cats.includes(filter) || p.room === filter);
  const grid = $('#tbGrid');
  grid.innerHTML = list.map(p => `<button class="slot ${p.id === view ? 'sel' : ''} ${used.includes(p.id) ? 'used' : ''} ${armedIds.includes(p.id) ? 'armed' : ''}" data-id="${p.id}" title="${p.name}">${p.icon}</button>`).join('');
  grid.querySelectorAll('.slot').forEach(b => b.onclick = () => onView(b.dataset.id));
  const p = PRANK_BY_ID[view] || list[0];
  if (!p) { $('#tbDetail').innerHTML = ''; return; }
  const victim = other(me);
  const isUsed = used.includes(p.id), full = armedCount >= RULES.maxArmedTraps;
  const r = RISK[p.risk];
  $('#tbDetail').innerHTML = `
    <h3>${p.icon} ${p.name}</h3>
    <div class="muted">${p.desc}</div>
    <dl>
      <dt>Object</dt><dd>${p.item}</dd>
      <dt>Room</dt><dd>${ROOMS[p.room].name} → ${HOTSPOTS[p.hotspot].label}</dd>
      <dt>Sequence</dt><dd>Use item, walk to the ${HOTSPOTS[p.hotspot].label}, hold E for ${p.prep}s</dd>
      <dt>Trigger</dt><dd>${TRIGGERS[p.trigger]}</dd>
      <dt>${CHARACTERS[victim].name}'s reaction</dt><dd>${lineHTML(p.lines[victim], lang)}</dd>
      <dt>Points</dt><dd>${p.points}</dd>
      <dt>Risk</dt><dd><span class="risk-tag" style="background:${r.color}">${r.label}</span> <span class="muted small">caught within ${r.catchRadius}m</span></dd>
      <dt>If caught</dt><dd>${lineHTML(CHARACTERS[me].caughtLine, lang)} (${RULES.points.caughtPenalty})</dd>
    </dl>
    <button class="btn primary use" id="tbUse" ${isUsed || full ? 'disabled' : ''}>${isUsed ? 'Used this round' : full ? 'Max pranks armed' : 'Use'}</button>`;
  const btn = $('#tbUse'); if (btn) btn.onclick = () => onUse(p.id);
  return p.id;
}

// ---------- prank card (storyboard style) ----------
let cardTimer = null;
export function showPrankCard(pr, owner, victim, lang) {
  const el = $('#prankCard');
  el.innerHTML = `<div>
      <p><b>Prank:</b> ${pr.name}</p>
      <p><b>Object:</b> ${pr.item}</p>
      <p><b>Sequence:</b> ${CHARACTERS[owner].name} rigged the ${HOTSPOTS[pr.hotspot].label}</p>
      <p><b>${CHARACTERS[victim].name}'s Reaction:</b> ${lang === 'en' ? '“' + pr.lines[victim][1] + '”' : `“<span class="ar">${pr.lines[victim][0]}</span>” / “${pr.lines[victim][1]}”`}</p>
    </div><div class="col2">
      <p><b>Points:</b> ${pr.points}, <b>Risk:</b> ${RISK[pr.risk].label}</p>
      <p><b>Winner of this one:</b> ${CHARACTERS[owner].name} 😏</p>
    </div>`;
  el.classList.remove('hidden');
  clearTimeout(cardTimer); cardTimer = setTimeout(() => el.classList.add('hidden'), 4500);
}

// ---------- results ----------
export function showResults(res, me) {
  $('#results').classList.remove('hidden');
  const w = res.winner;
  $('#resTitle').textContent = w === 'tie' ? "It's a tie! 🤝" : `${CHARACTERS[w].name} wins!${res.forfeit ? ' (forfeit)' : ''}`;
  for (const c of ['omar', 'shorok']) {
    const el = $('#res-' + c);
    el.classList.toggle('win', c === w);
    el.querySelector('img').src = portrait(c, c === w ? (c === 'shorok' ? 'laughing' : 'happy') : (w === 'tie' ? 'happy' : 'sad'));
    el.querySelector('.big-score').textContent = res.scores[c];
  }
  const s = res.stats;
  const rows = [['Pranks landed', 'landed'], ['Pranks armed', 'armed'], ['Pranks defused', 'defused'], ['Got caught', 'caught'], ['Pranks discovered', 'discovered'], ['Remote misses', 'missed'], ['Chores done', 'chores'], ['Points from pranks', 'pointsFromPranks']];
  $('#resTable').innerHTML = `<tr><th></th><th>Omar</th><th>Shorok</th></tr>` +
    rows.map(([l, k]) => `<tr><th>${l}</th><td>${s.omar[k]}</td><td>${s.shorok[k]}</td></tr>`).join('') +
    `<tr><th>Challenges</th><td>${res.challenges.omar.length}</td><td>${res.challenges.shorok.length}</td></tr>`;
  $('#rematchInfo').textContent = '';
  $('#btnRematch').disabled = false; $('#btnRematch').textContent = 'Rematch';
}

export function fillExpressionGallery() {
  $$('.expr-row').forEach(row => {
    const c = row.dataset.char;
    row.innerHTML = EXPRESSIONS[c].map(e => `<figure><img src="/assets/ref/${c}_${e}.jpg" alt="${e}"><figcaption>${e}</figcaption></figure>`).join('');
  });
}
