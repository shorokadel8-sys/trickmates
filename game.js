// TRICKMATES — authoritative match logic (one instance per private room)
import {
  HOTSPOTS, HOTSPOT_IDS, PRANK_BY_ID, RISK, RULES, CHALLENGES, CHARACTERS, ROOMS,
  roomAt, other, dist,
} from '../shared/data.js';

const now = () => Date.now() / 1000;
const SPAWN = { omar: { x: -9.5, z: -4.2, r: Math.PI }, shorok: { x: 0.5, z: -6.2, r: Math.PI } };
const DEBUG = process.env.TM_DEBUG === '1';

function newPlayer(char) {
  return {
    char, token: null, connected: false, ws: null,
    x: SPAWN[char].x, z: SPAWN[char].z, r: SPAWN[char].r, a: 'idle', lastPosAt: 0,
    score: 0, prep: null, interact: null, stunUntil: 0,
    chores: [], used: new Set(), distractReadyAt: 0, lure: null,
    emotion: 'happy', emotionUntil: 0, rematch: false,
    challenges: new Set(), landedRooms: new Set(), landedTimes: [],
    stats: { landed: 0, armed: 0, defused: 0, caught: 0, discovered: 0, chores: 0, missed: 0, pointsFromPranks: 0 },
  };
}

let trapSeq = 1;

export class Match {
  constructor(code, transport) {
    this.code = code;
    this.transport = transport;   // (char, msg) => void
    this.players = { omar: newPlayer('omar'), shorok: newPlayer('shorok') };
    this.host = null;
    this.traps = new Map();
    this.phase = 'lobby';
    this.round = 0;
    this.phaseEnds = 0;
    this.paused = false;
    this.pauseReason = null;
    this.pauseRemaining = 0;
    this.forfeitAt = 0;
    this.lastActive = now();
    this.results = null;
  }

  // ---------- messaging ----------
  send(char, msg) { this.transport(char, msg); }
  both(msg) { this.send('omar', msg); this.send('shorok', msg); }
  ev(type, data = {}, to = null) {
    const msg = { type: 'ev', ev: type, ...data };
    if (to) this.send(to, msg); else this.both(msg);
  }
  toast(char, text, kind = 'info') { this.ev('toast', { text, kind }, char); }

  lobbyInfo() {
    return {
      type: 'lobby', code: this.code, host: this.host, phase: this.phase,
      players: Object.fromEntries(Object.entries(this.players).map(([c, p]) => [c, { connected: p.connected, taken: !!p.token }])),
    };
  }

  // ---------- connection lifecycle ----------
  attach(char, ws, token) {
    const p = this.players[char];
    p.ws = ws; p.token = token; p.connected = true;
    this.lastActive = now();
    if (!this.host) this.host = char;
    if (this.paused && this.pauseReason === 'disconnect' && this.bothConnected()) {
      this.forfeitAt = 0;
      this.setPaused(false, 'reconnect');
      this.ev('toast', { text: `${CHARACTERS[char].name} reconnected!`, kind: 'good' });
    }
    this.both(this.lobbyInfo());
  }

  detach(char) {
    const p = this.players[char];
    p.connected = false; p.ws = null; p.prep = null;
    if (this.phase === 'playing' || this.phase === 'intermission') {
      this.forfeitAt = now() + RULES.reconnectSeconds;
      if (!this.paused) this.setPaused(true, 'disconnect');
      else this.pauseReason = 'disconnect';
      this.ev('toast', { text: `${CHARACTERS[char].name} lost connection — waiting ${RULES.reconnectSeconds}s…`, kind: 'warn' });
    }
    this.both(this.lobbyInfo());
  }

  leave(char) {
    const p = this.players[char];
    if (this.phase === 'playing' || this.phase === 'intermission') {
      this.endMatch(other(char));
    }
    p.token = null; p.connected = false; p.ws = null;
    if (this.host === char) this.host = this.players[other(char)].token ? other(char) : null;
    if (this.phase !== 'results') this.phase = 'lobby';
    this.both(this.lobbyInfo());
  }

  bothConnected() { return this.players.omar.connected && this.players.shorok.connected; }
  empty() { return !this.players.omar.connected && !this.players.shorok.connected; }

  // ---------- phases ----------
  start(char) {
    if (this.phase !== 'lobby' && this.phase !== 'results') return;
    if (char !== this.host) return this.toast(char, 'Only the room creator can start.', 'warn');
    if (!this.bothConnected()) return this.toast(char, 'Waiting for your partner to join…', 'warn');
    this.resetMatch();
    this.startRound(1);
  }

  resetMatch() {
    for (const c of ['omar', 'shorok']) {
      const old = this.players[c];
      const p = newPlayer(c);
      Object.assign(p, { token: old.token, ws: old.ws, connected: old.connected });
      this.players[c] = p;
    }
    this.results = null;
  }

  startRound(n) {
    this.round = n;
    this.phase = 'playing';
    this.phaseEnds = now() + RULES.roundSeconds;
    this.traps.clear();
    for (const c of ['omar', 'shorok']) {
      const p = this.players[c];
      p.used.clear(); p.prep = null; p.lure = null; p.stunUntil = 0;
      p.x = SPAWN[c].x; p.z = SPAWN[c].z; p.r = SPAWN[c].r;
      p.chores = [];
      this.refillChores(p);
    }
    this.ev('round', { round: n, rounds: RULES.rounds, spawn: SPAWN });
  }

  endRound() {
    if (this.round < RULES.rounds) {
      this.phase = 'intermission';
      this.phaseEnds = now() + RULES.intermissionSeconds;
      for (const p of Object.values(this.players)) p.prep = null;
      this.traps.clear();
      this.ev('round_end', { round: this.round, scores: this.scores() });
    } else this.endMatch(null);
  }

  endMatch(forfeitWinner) {
    const s = this.scores();
    let winner = forfeitWinner;
    if (!winner) winner = s.omar === s.shorok ? 'tie' : (s.omar > s.shorok ? 'omar' : 'shorok');
    this.phase = 'results';
    this.paused = false; this.pauseReason = null; this.forfeitAt = 0;
    this.traps.clear();
    this.results = {
      winner, forfeit: !!forfeitWinner, scores: s,
      stats: { omar: this.players.omar.stats, shorok: this.players.shorok.stats },
      challenges: { omar: [...this.players.omar.challenges], shorok: [...this.players.shorok.challenges] },
    };
    for (const p of Object.values(this.players)) p.rematch = false;
    this.ev('results', this.results);
  }

  rematch(char) {
    if (this.phase !== 'results') return;
    this.players[char].rematch = true;
    this.ev('rematch_req', { char });
    if (this.players.omar.rematch && this.players.shorok.rematch && this.bothConnected()) {
      this.resetMatch();
      this.startRound(1);
    }
  }

  setPaused(on, reason) {
    if (on === this.paused) return;
    const t = now();
    if (on) {
      this.pauseRemaining = Math.max(0, this.phaseEnds - t);
      for (const p of Object.values(this.players)) p.prep = null;
    } else {
      this.phaseEnds = t + this.pauseRemaining;
      for (const p of Object.values(this.players)) if (p.lure) p.lure.until += 0; // lures keep wall-clock
    }
    this.paused = on;
    this.pauseReason = on ? reason : null;
    this.ev('pause', { on, reason });
  }

  scores() { return { omar: this.players.omar.score, shorok: this.players.shorok.score }; }

  // ---------- helpers ----------
  addScore(p, pts, why) {
    p.score = Math.max(0, p.score + pts);
    this.ev('score', { char: p.char, pts, why, total: p.score });
  }
  emotion(p, e, secs = 2.5) { p.emotion = e; p.emotionUntil = now() + secs; }
  near(p, hs, extra = 0) {
    const h = HOTSPOTS[hs];
    return h && dist(p.x, p.z, h.pos[0], h.pos[1]) <= RULES.interactRadius + extra;
  }
  trapAt(hs) { for (const t of this.traps.values()) if (t.hs === hs) return t; return null; }
  armedCount(char) { let n = 0; for (const t of this.traps.values()) if (t.owner === char) n++; return n; }
  active() { return this.phase === 'playing' && !this.paused; }
  stunned(p) { return now() < p.stunUntil; }

  refillChores(p) {
    const pool = HOTSPOT_IDS.filter(h => !p.chores.includes(h));
    while (p.chores.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      p.chores.push(pool.splice(i, 1)[0]);
    }
  }

  award(p, id) {
    if (p.challenges.has(id)) return;
    const ch = CHALLENGES.find(c => c.id === id);
    p.challenges.add(id);
    p.score += ch.bonus;
    this.ev('challenge', { char: p.char, id, name: ch.name, bonus: ch.bonus, total: p.score });
  }

  // ---------- core prank resolution ----------
  fire(trap, victim) {
    const owner = this.players[trap.owner];
    const pr = PRANK_BY_ID[trap.prank];
    this.traps.delete(trap.id);
    const t = now();
    owner.score += pr.points;
    owner.stats.landed++; owner.stats.pointsFromPranks += pr.points;
    victim.stunUntil = t + RULES.stunSeconds;
    victim.prep = null; victim.interact = null;
    this.emotion(victim, pr.react, RULES.stunSeconds + 0.6);
    this.emotion(owner, 'laughing', 3);
    owner.landedRooms.add(pr.room);
    owner.landedTimes = owner.landedTimes.filter(x => t - x <= 45);
    owner.landedTimes.push(t);
    this.ev('prank', {
      prank: pr.id, owner: owner.char, victim: victim.char, hs: trap.hs,
      points: pr.points, total: owner.score, line: pr.lines[victim.char],
      vx: victim.x, vz: victim.z,
    });
    if (pr.room === 'kitchen') this.award(owner, 'kitchen_chaos');
    if (trap.unseen) this.award(owner, 'ghost_mode');
    if (owner.landedRooms.size >= 3) this.award(owner, 'grand_tour');
    if (owner.landedTimes.length >= 2) this.award(owner, 'double_trouble');
  }

  // ---------- message handling ----------
  handle(char, m) {
    const p = this.players[char];
    const o = this.players[other(char)];
    this.lastActive = now();
    switch (m.type) {
      case 'start': return this.start(char);
      case 'rematch': return this.rematch(char);
      case 'pause':
        if (this.phase === 'playing' || this.phase === 'intermission') {
          if (!m.on && this.pauseReason === 'disconnect') return;
          this.setPaused(!!m.on, m.on ? `${CHARACTERS[char].name} paused` : null);
        }
        return;
      case 'emote': {
        const allowed = ['laughing', 'angry', 'sneaky', 'happy', 'sad', 'embarrassed'];
        if (!allowed.includes(m.e)) return;
        this.emotion(p, m.e, 2.5);
        return this.ev('emote', { char, e: m.e });
      }
      case 'pos': return this.onPos(p, m);
    }
    if (!this.active() || this.stunned(p)) return;

    switch (m.type) {
      case 'prep_start': {
        const pr = PRANK_BY_ID[m.prank];
        if (!pr) return;
        if (p.used.has(pr.id)) return this.toast(char, 'You already used that item this round.', 'warn');
        if (!this.near(p, pr.hotspot, 0.4)) return this.toast(char, `Go to the ${HOTSPOTS[pr.hotspot].label} first.`, 'warn');
        const existing = this.trapAt(pr.hotspot);
        if (existing && existing.owner !== char) return this.fire(existing, p); // walked right into theirs!
        if (existing) return this.toast(char, 'You already rigged this spot.', 'warn');
        if (this.armedCount(char) >= RULES.maxArmedTraps) return this.toast(char, `Max ${RULES.maxArmedTraps} armed pranks — fire one first.`, 'warn');
        p.prep = { prank: pr.id, hs: pr.hotspot, t: now(), seen: false };
        this.emotion(p, 'sneaky', pr.prep + 1);
        return;
      }
      case 'prep_cancel': p.prep = null; return;
      case 'prep_done': {
        const pp = p.prep;
        if (!pp) return;
        const pr = PRANK_BY_ID[pp.prank];
        if (now() - pp.t < pr.prep * 0.85) return;
        if (!this.near(p, pp.hs, 0.6)) { p.prep = null; return this.toast(char, 'You moved away — preparation cancelled.', 'warn'); }
        p.prep = null;
        const trap = { id: 't' + (trapSeq++), owner: char, prank: pr.id, hs: pp.hs, armedAt: now(), unseen: !pp.seen };
        this.traps.set(trap.id, trap);
        p.used.add(pr.id);
        p.stats.armed++;
        this.addScore(p, RULES.points.prepared, 'Prank armed');
        if (trap.unseen) this.addScore(p, RULES.points.unseenBonus, 'Prepared unseen');
        this.ev('armed', { prank: pr.id, hs: pp.hs, id: trap.id, unseen: trap.unseen }, char);
        return;
      }
      case 'interact': {
        if (!HOTSPOTS[m.hs] || !this.near(p, m.hs, 0.4)) return;
        const trap = this.trapAt(m.hs);
        if (trap && trap.owner !== char) return this.fire(trap, p);
        p.interact = { hs: m.hs, t: now() };
        return;
      }
      case 'chore_done': {
        const it = p.interact;
        if (!it || it.hs !== m.hs || !p.chores.includes(m.hs)) return;
        if (now() - it.t < RULES.choreSeconds * 0.8 || !this.near(p, m.hs, 0.6)) return;
        p.interact = null;
        p.chores = p.chores.filter(h => h !== m.hs);
        this.refillChores(p);
        p.stats.chores++;
        this.addScore(p, RULES.points.chore, `Chore: ${HOTSPOTS[m.hs].chore}`);
        this.ev('chore', { char, hs: m.hs });
        if (p.stats.chores >= 5) this.award(p, 'busy_bee');
        return;
      }
      case 'search': {
        if (!HOTSPOTS[m.hs] || !this.near(p, m.hs, 0.4)) return;
        const trap = this.trapAt(m.hs);
        if (trap && trap.owner !== char) {
          this.traps.delete(trap.id);
          p.stats.defused++; o.stats.discovered++;
          p.score += RULES.points.defuseReward;
          o.score = Math.max(0, o.score + RULES.points.discoveredPenalty);
          this.emotion(p, 'sneaky', 2.5); this.emotion(o, 'sad', 2.5);
          this.ev('defused', { by: char, owner: o.char, prank: trap.prank, hs: m.hs, scores: this.scores() });
          this.award(p, 'sharp_eyes');
        } else {
          this.ev('search_empty', { hs: m.hs }, char);
        }
        return;
      }
      case 'activate': {
        const trap = this.traps.get(m.trap);
        if (!trap || trap.owner !== char) return;
        const pr = PRANK_BY_ID[trap.prank];
        if (pr.trigger !== 'remote') return;
        const h = HOTSPOTS[trap.hs];
        if (o.connected && dist(o.x, o.z, h.pos[0], h.pos[1]) <= RULES.remoteRadius && !this.stunned(o)) {
          return this.fire(trap, o);
        }
        this.traps.delete(trap.id);
        p.stats.missed++;
        this.addScore(p, RULES.points.remoteMiss, 'Prank avoided — nobody was there');
        this.emotion(p, 'sad', 2);
        this.ev('miss', { char, prank: pr.id, hs: trap.hs });
        return;
      }
      case 'distract': {
        if (!ROOMS[m.room]) return;
        const t = now();
        if (t < p.distractReadyAt) return this.toast(char, 'Distraction is recharging.', 'warn');
        p.distractReadyAt = t + RULES.distractCooldown;
        o.lure = { room: m.room, until: t + RULES.lureSeconds };
        this.ev('lure', { room: m.room, from: char, secs: RULES.lureSeconds }, o.char);
        this.ev('distract_ok', { room: m.room }, char);
        return;
      }
    }
  }

  onPos(p, m) {
    if (!(this.phase === 'playing' || this.phase === 'intermission')) return;
    const x = +m.x, z = +m.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const t = now();
    if (this.paused || this.stunned(p)) { p.r = +m.r || p.r; p.a = String(m.a || 'idle').slice(0, 16); p.lastPosAt = t; return; }
    const dt = Math.min(1, t - (p.lastPosAt || t));
    const maxStep = RULES.runSpeed * 1.6 * dt + 0.6;
    if (!DEBUG && dist(p.x, p.z, x, z) > maxStep) {
      p.lastPosAt = t;
      return this.send(p.char, { type: 'correct', x: p.x, z: p.z });
    }
    p.x = x; p.z = z; p.r = +m.r || 0; p.a = String(m.a || 'idle').slice(0, 16); p.lastPosAt = t;
  }

  // ---------- 10 Hz tick ----------
  tick() {
    const t = now();
    if (this.forfeitAt && t > this.forfeitAt) {
      const winner = this.players.omar.connected ? 'omar' : (this.players.shorok.connected ? 'shorok' : 'tie');
      this.forfeitAt = 0;
      this.endMatch(winner === 'tie' ? null : winner);
    }
    if ((this.phase === 'playing' || this.phase === 'intermission') && !this.paused && t >= this.phaseEnds) {
      if (this.phase === 'playing') this.endRound(); else this.startRound(this.round + 1);
    }
    if (this.active()) {
      for (const c of ['omar', 'shorok']) {
        const p = this.players[c], o = this.players[other(c)];
        // catch detection while preparing
        if (p.prep) {
          const pr = PRANK_BY_ID[p.prep.prank];
          const h = HOTSPOTS[p.prep.hs];
          if (t - p.prep.t > pr.prep + 6) p.prep = null;
          else if (o.connected && roomAt(o.x, o.z) === h.room) {
            p.prep.seen = true;
            if (dist(o.x, o.z, p.x, p.z) <= RISK[pr.risk].catchRadius && !this.stunned(o)) {
              p.prep = null;
              p.stats.caught++;
              p.score = Math.max(0, p.score + RULES.points.caughtPenalty);
              o.score += RULES.points.catchReward;
              this.emotion(p, 'embarrassed', 3); this.emotion(o, 'angry', 3);
              this.ev('caught', { by: o.char, who: p.char, prank: pr.id, line: CHARACTERS[p.char].caughtLine, scores: this.scores() });
            }
          }
        }
        // lure objective
        if (p.lure) {
          if (t > p.lure.until) { p.lure = null; this.ev('lure_end', { ok: false }, c); }
          else if (roomAt(p.x, p.z) === p.lure.room) {
            p.lure = null;
            this.addScore(p, RULES.points.lure, 'Answered the distraction');
            this.ev('lure_end', { ok: true }, c);
          }
        }
      }
      // proximity triggers
      for (const trap of [...this.traps.values()]) {
        const pr = PRANK_BY_ID[trap.prank];
        if (pr.trigger !== 'proximity') continue;
        const v = this.players[other(trap.owner)];
        const h = HOTSPOTS[trap.hs];
        if (v.connected && !this.stunned(v) && dist(v.x, v.z, h.pos[0], h.pos[1]) <= RULES.proximityRadius) this.fire(trap, v);
      }
    }
    for (const p of Object.values(this.players)) if (p.emotionUntil && t > p.emotionUntil) { p.emotion = 'happy'; p.emotionUntil = 0; }
    if (this.phase !== 'lobby') for (const c of ['omar', 'shorok']) if (this.players[c].connected) this.send(c, this.snapshot(c));
  }

  snapshot(char) {
    const t = now();
    const p = this.players[char];
    const pub = (q) => ({
      x: +q.x.toFixed(3), z: +q.z.toFixed(3), r: +q.r.toFixed(3), a: q.a, score: q.score,
      connected: q.connected, stunned: t < q.stunUntil, emotion: q.emotion, room: roomAt(q.x, q.z),
      preparing: !!q.prep,
    });
    const tells = [];
    for (const tr of this.traps.values()) {
      if (tr.owner === char) continue;
      const rr = RISK[PRANK_BY_ID[tr.prank].risk].tellRadius;
      if (rr > 0) tells.push({ hs: tr.hs, r: rr });
    }
    return {
      type: 'state', phase: this.phase, round: this.round, rounds: RULES.rounds,
      timeLeft: Math.max(0, this.paused ? this.pauseRemaining : this.phaseEnds - t),
      paused: this.paused, pauseReason: this.pauseReason,
      forfeitIn: this.forfeitAt ? Math.max(0, this.forfeitAt - t) : 0,
      players: { omar: pub(this.players.omar), shorok: pub(this.players.shorok) },
      you: {
        char,
        traps: [...this.traps.values()].filter(x => x.owner === char).map(x => ({ id: x.id, prank: x.prank, hs: x.hs })),
        used: [...p.used], chores: p.chores,
        distractIn: Math.max(0, p.distractReadyAt - t),
        lure: p.lure ? { room: p.lure.room, left: Math.max(0, p.lure.until - t) } : null,
        prep: p.prep ? { prank: p.prep.prank, hs: p.prep.hs, elapsed: t - p.prep.t } : null,
        challenges: [...p.challenges], tells,
      },
    };
  }
}
