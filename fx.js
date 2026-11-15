// TRICKMATES — prank visual effects + synthesized sound effects (no external assets needed)
import * as THREE from 'three';
import { HOTSPOTS } from '/shared/data.js';
import { drawDesktop, drawTV, drawMirror } from './world.js';

// ======================= AUDIO =======================
export class Sound {
  constructor() { this.ctx = null; this.volume = 0.7; this.enabled = true; }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); } catch { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.value = this.enabled ? this.volume : 0;
    return this.ctx;
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.3, filter = 1200, type = 'lowpass', delay = 0, sweepTo = null) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filter, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  play(name) {
    switch (name) {
      case 'click': return this.tone('triangle', 660, 880, 0.06, 0.15);
      case 'select': this.tone('triangle', 520, 780, 0.08, 0.15); return this.tone('triangle', 780, 1040, 0.08, 0.12, 0.06);
      case 'pop': return this.tone('sine', 300, 1200, 0.12, 0.35);
      case 'boing': return this.tone('sine', 180, 520, 0.45, 0.4);
      case 'honk': this.tone('sawtooth', 330, 300, 0.35, 0.25); return this.tone('square', 440, 400, 0.35, 0.12);
      case 'whoosh': return this.noise(0.8, 0.4, 400, 'bandpass', 0, 3000);
      case 'bang': this.noise(0.5, 0.6, 2500); return this.tone('sine', 120, 40, 0.4, 0.5);
      case 'squeak': this.tone('sine', 1200, 1900, 0.09, 0.25); return this.tone('sine', 1700, 1100, 0.09, 0.2, 0.09);
      case 'splash': this.noise(0.6, 0.5, 3000, 'highpass'); return this.noise(0.4, 0.3, 800, 'lowpass', 0.05);
      case 'roar': this.noise(1.1, 0.6, 300, 'lowpass', 0, 120); return this.tone('sawtooth', 140, 70, 1.1, 0.3);
      case 'alarm': for (let i = 0; i < 8; i++) this.tone('square', 1046, 1046, 0.09, 0.18, i * 0.14); return;
      case 'kettle': return this.tone('sine', 1800, 2600, 1.4, 0.18);
      case 'pfft': return this.noise(0.9, 0.4, 220, 'lowpass', 0, 90);
      case 'moo': this.tone('sawtooth', 160, 110, 0.9, 0.25); return this.tone('sine', 165, 115, 0.9, 0.2);
      case 'gasp': return this.noise(0.25, 0.25, 1800, 'bandpass', 0, 3500);
      case 'scream': this.tone('sawtooth', 600, 950, 0.3, 0.12); return this.tone('triangle', 900, 650, 0.35, 0.1, 0.25);
      case 'laugh': for (let i = 0; i < 5; i++) this.tone('triangle', 420 - i * 15, 340 - i * 15, 0.1, 0.15, i * 0.13); return;
      case 'rustle': return this.noise(0.35, 0.12, 2500, 'highpass');
      case 'success': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.18, i * 0.08)); return;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f * 0.95, 0.2, 0.18, i * 0.12)); return;
      case 'caught': this.tone('square', 880, 880, 0.12, 0.12); return this.tone('square', 660, 660, 0.25, 0.12, 0.13);
      case 'tick': return this.tone('sine', 1000, 1000, 0.05, 0.1);
      case 'round': [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.2, i * 0.12)); return;
      case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.2, i * 0.13)); return;
      case 'bubble': for (let i = 0; i < 10; i++) this.tone('sine', 400 + Math.random() * 600, 900 + Math.random() * 700, 0.08, 0.12, i * 0.07); return;
      case 'ring': for (let i = 0; i < 4; i++) { this.tone('sine', 880, 880, 0.12, 0.15, i * 0.3); this.tone('sine', 1100, 1100, 0.12, 0.12, i * 0.3 + 0.12); } return;
      case 'music': [523, 587, 659, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.08, i * 0.15)); return;
    }
  }
}

// ======================= VISUALS =======================
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();
const sparkTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff6c8'; g.translate(32, 32);
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -30); g.lineTo(4, 0); g.lineTo(0, 30); g.lineTo(-4, 0); g.fill(); }
  return new THREE.CanvasTexture(c);
})();

class Burst {
  constructor(scene, o) {
    const n = o.count || 80;
    this.v = []; this.life = o.life || 1.6; this.t = 0; this.grav = o.gravity ?? -6; this.drag = o.drag ?? 0.5;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const palette = (o.colors || ['#ffffff']).map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = o.at.x + (Math.random() - 0.5) * (o.spread || 0.1);
      pos[i * 3 + 1] = o.at.y + (Math.random() - 0.5) * (o.spread || 0.1);
      pos[i * 3 + 2] = o.at.z + (Math.random() - 0.5) * (o.spread || 0.1);
      const dir = o.dir ? o.dir.clone() : new THREE.Vector3(0, 1, 0);
      const sp = (o.speed || 3) * (0.4 + Math.random() * 0.8), cone = o.cone ?? 1;
      this.v.push(new THREE.Vector3(dir.x + (Math.random() - 0.5) * 2 * cone, dir.y + (Math.random() - 0.5) * 2 * cone, dir.z + (Math.random() - 0.5) * 2 * cone).normalize().multiplyScalar(sp));
      const c = palette[i % palette.length]; col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.PointsMaterial({ size: o.size || 0.12, map: o.square ? null : dotTex, vertexColors: true, transparent: true, depthWrite: false, opacity: o.opacity ?? 1 });
    this.points = new THREE.Points(geo, this.mat); scene.add(this.points); this.scene = scene; this.baseOpacity = o.opacity ?? 1; this.grow = o.grow || 0; this.size0 = o.size || 0.12;
  }
  update(dt) {
    this.t += dt;
    const p = this.points.geometry.attributes.position;
    for (let i = 0; i < this.v.length; i++) {
      const v = this.v[i]; v.y += this.grav * dt; v.multiplyScalar(1 - this.drag * dt);
      p.array[i * 3] += v.x * dt; p.array[i * 3 + 1] = Math.max(0.02, p.array[i * 3 + 1] + v.y * dt); p.array[i * 3 + 2] += v.z * dt;
    }
    p.needsUpdate = true;
    const k = this.t / this.life;
    this.mat.opacity = this.baseOpacity * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    if (this.grow) this.mat.size = this.size0 * (1 + this.grow * k);
    if (k >= 1) { this.scene.remove(this.points); this.points.geometry.dispose(); this.mat.dispose(); return false; }
    return true;
  }
}

function comicTexture(text, color = '#f4c35a') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.font = '900 92px "Baloo 2", "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 18; g.strokeStyle = '#2a1d14'; g.lineJoin = 'round'; g.strokeText(text, 256, 84);
  g.fillStyle = color; g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  constructor(scene, world, sound) {
    this.scene = scene; this.world = world; this.sound = sound;
    this.items = [];      // {update(dt) => bool}
    this.glints = new Map();
  }
  add(fn) { this.items.push(fn); }
  burst(o) { const b = new Burst(this.scene, o); this.add(dt => b.update(dt)); return b; }
  timeline(dur, step, done) { let t = 0; this.add(dt => { t += dt; step(Math.min(t / dur, 1), t, dt); if (t >= dur) { done && done(); return false; } return true; }); }

  comic(text, pos, color, scale = 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: comicTexture(text, color), transparent: true, depthTest: false }));
    sp.position.copy(pos); sp.renderOrder = 10; this.scene.add(sp);
    const base = new THREE.Vector3(1.6, 0.5, 1).multiplyScalar(scale);
    this.timeline(1.6, (k) => {
      const pop = k < 0.15 ? k / 0.15 * 1.25 : 1.25 - Math.min(0.25, (k - 0.15) * 2);
      sp.scale.copy(base).multiplyScalar(pop); sp.position.y = pos.y + k * 0.6;
      sp.material.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    }, () => { this.scene.remove(sp); sp.material.map.dispose(); sp.material.dispose(); });
  }

  // highlight ring shown under the focused hotspot
  ensureRing() {
    if (this.ring) return this.ring;
    const r = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 40), new THREE.MeshBasicMaterial({ color: 0xf4c35a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.visible = false; this.scene.add(r); this.ring = r; return r;
  }
  ensureArrow() {
    if (this.arrow) return this.arrow;
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xf4c35a, emissive: 0xf4a020, emissiveIntensity: 0.6 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 16), m); cone.rotation.x = Math.PI; g.add(cone);
    g.visible = false; this.scene.add(g); this.arrow = g; return g;
  }
  setGlint(hs, on) {
    let s = this.glints.get(hs);
    if (!s && on) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, opacity: 0.9 }));
      const a = this.world.anchors[hs].position; s.position.set(a.x, 1.25, a.z); s.scale.setScalar(0.35); this.scene.add(s); this.glints.set(hs, s);
    }
    if (s) s.visible = on;
  }

  update(dt, time) {
    this.items = this.items.filter(f => f(dt) !== false);
    for (const s of this.glints.values()) if (s.visible) { s.material.rotation = time * 2; s.scale.setScalar(0.25 + Math.abs(Math.sin(time * 4)) * 0.2); }
    if (this.ring?.visible) this.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
    if (this.arrow?.visible) { this.arrow.position.y = this.arrowY + Math.sin(time * 4) * 0.12; this.arrow.rotation.y = time * 2; }
  }

  // ---------- reactions ----------
  hotspotPos(hs, y = 1) { const p = HOTSPOTS[hs].pos; return new THREE.Vector3(p[0], y, p[1]); }

  play(prank, hs, victim) {
    const W = this.world.fx, S = this.sound, at = this.hotspotPos(hs, 1.1);
    const vpos = victim.root.position.clone(); const vhead = victim.headWorld();
    const conf = ['#f4c35a', '#f0755a', '#5b8de0', '#7bd389', '#e98ad8', '#ffffff'];
    S.play('gasp');
    switch (prank.fx) {
      case 'spider': {
        const sp = makeSpider(); sp.position.set(at.x + 0.35, 0.82, at.z + 0.05); this.scene.add(sp);
        const from = sp.position.clone(), to = new THREE.Vector3(vpos.x, 0.02, vpos.z + 0.3);
        S.play('scream');
        this.timeline(3.2, (k, t) => {
          if (k < 0.25) { sp.position.y = 0.82 + Math.abs(Math.sin(t * 30)) * 0.03; sp.rotation.y = Math.sin(t * 20) * 0.3; }
          else { const q = (k - 0.25) / 0.75; sp.position.lerpVectors(from, to, Math.min(1, q * 1.4)); sp.position.y = Math.max(0.02, from.y * (1 - q * 2)) + Math.abs(Math.sin(t * 25)) * 0.03; sp.lookAt(to.x, sp.position.y, to.z); }
          sp.children.forEach((c, i) => { if (c.userData.leg) c.rotation.z = c.userData.base + Math.sin(t * 40 + i) * 0.35; });
        }, () => this.scene.remove(sp));
        this.comic('EEEK!', vhead.clone().add(new THREE.Vector3(0, 0.6, 0)), '#f0755a');
        break;
      }
      case 'screenbug': case 'screenface': {
        const L = W.laptop, g = L.canvas.getContext('2d');
        S.play(prank.fx === 'screenbug' ? 'scream' : 'boing');
        this.timeline(3.5, (k, t) => {
          drawDesktop(g, 512, 320);
          if (prank.fx === 'screenbug') {
            for (let i = 0; i < 3; i++) drawBug(g, 60 + ((t * 160 + i * 140) % 420), 160 + Math.sin(t * 6 + i * 2) * 80, t * 10 + i, 1 + i * 0.3);
          } else {
            const s = Math.min(1, k * 4); drawGoofyFace(g, 256, 165, 140 * (s < 1 ? s * 1.15 : 1 + Math.sin(t * 10) * 0.04), t);
          }
          L.tex.needsUpdate = true;
        }, () => L.redraw());
        L.screen.scale.setScalar(1);
        this.comic(prank.fx === 'screenbug' ? 'BZZZT!' : 'SURPRISE!', at.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f4c35a');
        break;
      }
      case 'chairspin': {
        const ch = W.chair, start = ch.position.clone(); S.play('whoosh');
        this.timeline(2.6, (k, t) => { ch.rotation.y = t * 18 * (1 - k); ch.position.x = start.x + Math.sin(k * Math.PI) * 1.4; ch.position.z = start.z + Math.sin(k * Math.PI * 2) * 0.4; }, () => { ch.position.copy(start); ch.rotation.y = 0; });
        this.comic('WHEEE!', at.clone().add(new THREE.Vector3(0, 1, 0.5)), '#7bd389');
        break;
      }
      case 'honk': {
        const b = W.honkBook, base = b.position.clone(); S.play('honk');
        this.timeline(1.5, (k) => { b.position.x = base.x + Math.sin(k * Math.PI) * 0.6; b.rotation.y = k * 6; b.position.y = base.y + Math.sin(k * Math.PI) * 0.3; }, () => { b.position.copy(base); b.rotation.y = 0; });
        this.comic('HONK!', at.clone().add(new THREE.Vector3(0.6, 0.9, 0)), '#f4c35a', 1.1);
        break;
      }
      case 'rocket': {
        const r = makeRocket(); const p0 = this.hotspotPos(hs, 0.95); r.position.copy(p0); r.position.z += 0.1; this.scene.add(r);
        S.play('whoosh');
        let smokeT = 0;
        this.timeline(1.6, (k, t, dt) => {
          r.position.y = 0.95 + k * k * 4.5; r.rotation.y = t * 12; r.position.x = p0.x + Math.sin(t * 9) * 0.15;
          smokeT += dt; if (smokeT > 0.05) { smokeT = 0; this.burst({ at: r.position.clone(), count: 6, colors: ['#ffffff', '#ffd59a'], speed: 0.6, gravity: 0.5, life: 0.9, size: 0.3, opacity: 0.7, grow: 1.5 }); }
        }, () => {
          this.burst({ at: r.position.clone(), count: 220, colors: conf, speed: 5, gravity: -4, life: 2.6, size: 0.1, square: true, drag: 1.2 });
          S.play('bang'); this.scene.remove(r);
          this.comic('KA-BOOM!', r.position.clone().add(new THREE.Vector3(0, -0.6, 0)), '#f0755a', 1.3);
        });
        break;
      }
      case 'sponge': {
        const d = makeDonut(); d.position.set(vpos.x, 1.35, vpos.z + 0.35); this.scene.add(d);
        S.play('squeak'); setTimeout(() => S.play('squeak'), 300);
        this.timeline(2.2, (k, t) => { d.scale.set(1 + Math.sin(t * 18) * 0.25, 1 - Math.sin(t * 18) * 0.25, 1); d.rotation.x = Math.PI / 2.3; }, () => this.scene.remove(d));
        this.comic('SQUEAK!', vhead.clone().add(new THREE.Vector3(0, 0.6, 0)), '#f4c35a');
        break;
      }
      case 'jackbox': {
        const door = W.fridgeDoor; const jb = makeJack(); const fr = W.fridge.position; jb.position.set(fr.x, 1.1, fr.z + 0.25); this.scene.add(jb);
        S.play('boing');
        this.timeline(3, (k, t) => {
          door.rotation.y = -Math.min(1, k * 6) * 1.9 * (k > 0.85 ? (1 - k) / 0.15 : 1);
          const sp = Math.min(1, k * 5); jb.scale.setScalar(sp); jb.position.z = fr.z + 0.25 + sp * 0.6; jb.position.y = 1.1 + Math.sin(t * 14) * 0.1 * (1 - k);
          jb.rotation.z = Math.sin(t * 12) * 0.4 * (1 - k);
        }, () => { this.scene.remove(jb); door.rotation.y = 0; });
        this.comic('BOING!', at.clone().add(new THREE.Vector3(0.5, 1.1, 0.6)), '#e98ad8');
        break;
      }
      case 'flour': {
        S.play('pfft'); S.play('bang');
        this.burst({ at: this.hotspotPos(hs, 1.0), count: 260, colors: ['#ffffff', '#f6efe2', '#fdf8ee'], speed: 3.2, gravity: -0.8, life: 3, size: 0.38, opacity: 0.75, drag: 2.2, grow: 1.4, cone: 1.2 });
        this.burst({ at: vhead.clone(), count: 80, colors: ['#ffffff'], speed: 1.2, gravity: -0.5, life: 2.4, size: 0.3, opacity: 0.6, drag: 2, grow: 1 });
        victim.flash(0xffffff, 1.0);
        this.comic('POOF!', at.clone().add(new THREE.Vector3(0, 1.2, 0)), '#ffffff', 1.2);
        break;
      }
      case 'kettle': {
        const k0 = W.kettle; S.play('kettle');
        this.timeline(2.2, (k, t, dt) => { k0.rotation.z = Math.sin(t * 40) * 0.12; k0.position.y = 0.9 + Math.abs(Math.sin(t * 25)) * 0.04; if (Math.random() < 0.6) this.burst({ at: k0.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.15, 0.2, 0)), count: 4, colors: ['#ffffff'], speed: 1.5, gravity: 1, life: 1, size: 0.25, opacity: 0.5, grow: 2, dir: new THREE.Vector3(0.5, 1, 0) }); }, () => { k0.rotation.z = 0; k0.position.y = 0.9; });
        this.comic('WHEEEE!', at.clone().add(new THREE.Vector3(0, 1.1, 0)), '#ffffff');
        break;
      }
      case 'splash': case 'shower': {
        S.play('splash');
        const src = prank.fx === 'shower' ? W.showerHead.clone() : this.hotspotPos(hs, 1.1);
        const dir = new THREE.Vector3(vpos.x - src.x, 0.6, vpos.z - src.z).normalize();
        let n = 0;
        this.timeline(1.6, () => { if (n++ % 2 === 0) this.burst({ at: src, count: 18, colors: ['#8fd3ff', '#cfeeff', '#5fb8f0'], speed: 4.5, gravity: -9, life: 1.1, size: 0.09, dir, cone: 0.25 }); });
        this.burst({ at: vhead.clone(), count: 60, colors: ['#8fd3ff', '#ffffff'], speed: 2, gravity: -9, life: 1.2, size: 0.08 });
        victim.flash(0x7fc4ff, 0.7);
        this.comic('SPLASH!', vhead.clone().add(new THREE.Vector3(0, 0.6, 0)), '#8fd3ff');
        break;
      }
      case 'tvcow': {
        const T = W.tv, g = T.canvas.getContext('2d'); S.play('moo'); setTimeout(() => S.play('music'), 700);
        this.timeline(4, (k, t) => { drawCowTV(g, 512, 288, t); T.tex.needsUpdate = true; }, () => T.redraw());
        this.comic('MOOO!', at.clone().add(new THREE.Vector3(-0.4, 1.0, 0)), '#ffffff', 1.1);
        break;
      }
      case 'whoopee': {
        S.play('pfft');
        this.burst({ at: vpos.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 40, colors: ['#e8dcc0', '#d6caa8'], speed: 1.2, gravity: 0.4, life: 1.6, size: 0.3, opacity: 0.5, grow: 2 });
        const cush = W.sofa?.cushions?.[1]; if (cush) { const y0 = cush.position.y; this.timeline(0.8, (k) => { cush.scale.y = 1 - Math.sin(k * Math.PI) * 0.6; }, () => { cush.scale.y = 1; cush.position.y = y0; }); }
        this.comic('PFFFRT!', vhead.clone().add(new THREE.Vector3(0, 0.5, 0)), '#c9e27b', 1.1);
        break;
      }
      case 'roar': {
        S.play('roar');
        for (let i = 0; i < 4; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: 0xf4c35a, transparent: true }));
          ring.rotation.x = Math.PI / 2; ring.position.copy(this.hotspotPos(hs, 0.6)); this.scene.add(ring);
          let t0 = -i * 0.18; this.add(dt => { t0 += dt; if (t0 < 0) return true; ring.scale.setScalar(1 + t0 * 6); ring.material.opacity = Math.max(0, 1 - t0); if (t0 > 1) { this.scene.remove(ring); return false; } return true; });
        }
        const ct = W.coffeeTable; const y0 = ct.position.y; this.timeline(1.2, (k, t) => { ct.position.y = y0 + Math.abs(Math.sin(t * 30)) * 0.03 * (1 - k); }, () => ct.position.y = y0);
        this.comic('ROAAAR!', at.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f0755a', 1.2);
        break;
      }
      case 'plantdance': {
        const pl = W.plant; const glasses = makeGlasses(); glasses.position.set(0, 1.22, 0.2); pl.add(glasses); S.play('music');
        this.timeline(3.5, (k, t) => { pl.rotation.z = Math.sin(t * 9) * 0.25; pl.rotation.y = Math.sin(t * 4.5) * 0.4; pl.position.y = Math.abs(Math.sin(t * 9)) * 0.08; }, () => { pl.remove(glasses); pl.rotation.set(0, 0, 0); pl.position.y = 0; });
        this.comic('♪ DISCO ♪', at.clone().add(new THREE.Vector3(0, 1.6, 0)), '#e98ad8');
        break;
      }
      case 'mirror': {
        const Mi = W.mirror, g = Mi.canvas.getContext('2d'); S.play('scream');
        this.timeline(4, (k, t) => { drawMirror(g, 384, 320, Math.min(1, k * 3)); drawBooMirror(g, 384, 320, Math.min(1, k * 2.5), t); Mi.tex.needsUpdate = true; }, () => Mi.redraw(0));
        this.comic('BOO!', at.clone().add(new THREE.Vector3(0, 1.3, 0.3)), '#ffffff', 1.2);
        break;
      }
      case 'snake': {
        const sn = makeSnake(); const tw = this.hotspotPos(hs, 0.7); sn.position.copy(tw); sn.position.z -= 0.3; this.scene.add(sn); S.play('scream');
        this.timeline(3, (k, t) => {
          const sp = Math.min(1, k * 4); sn.scale.setScalar(sp); sn.position.y = 0.7 + Math.sin(Math.min(1, k * 3) * Math.PI) * 0.5;
          sn.children.forEach((c, i) => { c.position.x = Math.sin(t * 10 + i * 0.7) * 0.08; });
          sn.lookAt(vpos.x, sn.position.y, vpos.z);
        }, () => this.scene.remove(sn));
        this.comic('HISSS!', tw.clone().add(new THREE.Vector3(0, 1.1, -0.4)), '#7bd389');
        break;
      }
      case 'foam': {
        S.play('bubble'); setTimeout(() => S.play('bubble'), 600);
        const c = this.hotspotPos(hs, 0.6); const n = 60;
        const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.92 }), n);
        const offs = Array.from({ length: n }, () => [new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 1.4, (Math.random() - 0.5) * 3.2), 0.15 + Math.random() * 0.35, Math.random() * 6]);
        this.scene.add(inst); const m4 = new THREE.Matrix4();
        this.timeline(4.5, (k, t) => {
          const g = k < 0.3 ? k / 0.3 : (k > 0.8 ? (1 - k) / 0.2 : 1);
          offs.forEach(([o, r, ph], i) => { m4.makeScale(r * g, r * g, r * g); m4.setPosition(c.x + o.x * g - 0.5, c.y + o.y * g + Math.sin(t * 2 + ph) * 0.05, c.z + o.z * g); inst.setMatrixAt(i, m4); });
          inst.instanceMatrix.needsUpdate = true;
        }, () => { this.scene.remove(inst); inst.geometry.dispose(); });
        victim.flash(0xffffff, 0.6);
        this.comic('BLUB BLUB!', c.clone().add(new THREE.Vector3(-0.6, 1.8, 0)), '#cfeeff', 1.1);
        break;
      }
      case 'alarm': {
        const cl = W.clock; const y0 = cl.position.y; S.play('alarm');
        this.timeline(2.2, (k, t) => { cl.position.y = y0 + Math.abs(Math.sin(t * 30)) * 0.08; cl.rotation.z = Math.sin(t * 50) * 0.2; }, () => { cl.position.y = y0; cl.rotation.z = 0; });
        this.comic('RING RING!', at.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f0755a');
        break;
      }
      case 'confetti': {
        S.play('bang');
        this.burst({ at: this.hotspotPos(hs, 0.9).add(new THREE.Vector3(0, 0, -0.6)), count: 260, colors: conf, speed: 5, gravity: -5, life: 3, size: 0.09, square: true, drag: 1.3 });
        this.comic('POP!', at.clone().add(new THREE.Vector3(0, 1.2, 0)), '#f4c35a', 1.2);
        break;
      }
      case 'dino': {
        const wd = W.wardrobe; const dino = makeDino(); const wp = wd.g.position; dino.position.set(wp.x + 0.9, 0, wp.z); dino.rotation.y = Math.PI / 2; this.scene.add(dino);
        S.play('roar');
        this.timeline(3.8, (k, t) => {
          const o = Math.min(1, k * 5) * (k > 0.88 ? (1 - k) / 0.12 : 1);
          wd.doors.forEach(d => { d.piv.rotation.y = d.s * o * 1.6; });
          const inf = Math.min(1, k * 3); dino.scale.setScalar(0.2 + inf * 0.9 + Math.sin(t * 8) * 0.03 * inf); dino.rotation.z = Math.sin(t * 5) * 0.08;
          if (k > 0.85) dino.scale.multiplyScalar((1 - k) / 0.15);
        }, () => { this.scene.remove(dino); wd.doors.forEach(d => d.piv.rotation.y = 0); });
        this.comic('RAWR!', at.clone().add(new THREE.Vector3(0.8, 1.6, 0)), '#7bd389', 1.3);
        break;
      }
      case 'squeak': {
        let n = 0; this.timeline(3, (k) => { if (k * 6 > n) { n++; S.play('squeak'); this.comic('squeak!', victim.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, 0.3)), '#f7b4b4', 0.6); } });
        break;
      }
    }
    // stars around victim head
    this.burst({ at: vhead.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 14, colors: ['#ffe27a'], speed: 1.4, gravity: 0, life: 1.6, size: 0.14, drag: 2 });
  }

  caught(pos) { this.comic('CAUGHT!', pos.clone().add(new THREE.Vector3(0, 2.4, 0)), '#f0755a', 1.1); }
  defused(hs) { this.burst({ at: this.hotspotPos(hs, 1.0), count: 40, colors: ['#7bd389', '#ffffff'], speed: 2, gravity: -2, life: 1.2, size: 0.12 }); this.comic('DEFUSED!', this.hotspotPos(hs, 1.8), '#7bd389'); }
  armed(hs) { this.burst({ at: this.hotspotPos(hs, 1.0), count: 18, colors: ['#f4c35a'], speed: 1.2, gravity: 0, life: 0.8, size: 0.1, drag: 3 }); }
  emote(char, e) {
    const map = { laughing: ['HAHA!', '#f4c35a'], angry: ['GRRR!', '#f0755a'], sneaky: ['hehe…', '#e98ad8'], happy: ['♥', '#f08a8a'], sad: ['…', '#9ab3d6'], embarrassed: ['oops', '#f7b4b4'] };
    const [txt, col] = map[e] || ['!', '#fff'];
    this.comic(txt, char.headWorld().add(new THREE.Vector3(0, 0.55, 0)), col, 0.8);
  }
}

// ======================= props =======================
function makeSpider() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x1b1716, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), m); body.scale.set(1, 0.7, 1.3); body.position.z = -0.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), m); head.position.z = 0.08; g.add(head);
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff8fa0, emissive: 0xff4060, emissiveIntensity: 0.6 })); eye.position.set(s * 0.025, 0.02, 0.125); g.add(eye); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.22, 6), m);
    leg.position.set(s * 0.1, 0, -0.06 + i * 0.05); leg.rotation.y = (i - 1.5) * 0.35 * s; leg.userData = { leg: true, base: s * 1.0 }; leg.rotation.z = s * 1.0; g.add(leg);
  }
  g.scale.setScalar(1.4); return g;
}
function makeRocket() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xe0533a, roughness: 0.4 }), wht = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.4 }), yel = new THREE.MeshStandardMaterial({ color: 0xf4c35a, roughness: 0.4 });
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 16), i % 2 ? wht : red); c.position.y = 0.04 + i * 0.07; g.add(c); }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 16), red); tip.position.y = 0.38; g.add(tip);
  for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.08), yel); const a = i / 3 * Math.PI * 2; fin.position.set(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08); fin.rotation.y = -a; g.add(fin); }
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), yel); star.position.set(0, 0.2, 0.07); g.add(star);
  g.scale.setScalar(1.6); return g;
}
function makeDonut() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.055, 12, 24), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 })));
  const icing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 12, 24, Math.PI * 2), new THREE.MeshStandardMaterial({ color: 0xf29ac0, roughness: 0.5 })); icing.position.z = 0.015; icing.scale.z = 0.6; g.add(icing);
  return g;
}
function makeJack() {
  const g = new THREE.Group();
  const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.06, 0.012, 64, 6, 1, 8), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.8, roughness: 0.3 })); spring.scale.set(1, 1, 3); spring.rotation.x = Math.PI / 2; g.add(spring);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfbe3c8 })); head.position.y = 0.25; g.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe0333a })); nose.position.set(0, 0.24, 0.16); g.add(nose);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff })); e.position.set(s * 0.06, 0.31, 0.13); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); p.position.set(s * 0.06 + 0.01, 0.3, 0.175); g.add(p);
  }
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x5b8de0 })); hat.position.y = 0.47; g.add(hat);
  return g;
}
function makeGlasses() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), m); l.position.x = s * 0.1; g.add(l); }
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.01), m); g.add(b); return g;
}
function makeSnake() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x5aa04a, roughness: 0.5 }), m2 = new THREE.MeshStandardMaterial({ color: 0xe8d36a, roughness: 0.5 });
  for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 - i * 0.003, 10, 8), i % 3 ? m : m2); s.position.z = -i * 0.07; g.add(s); }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); e.position.set(s * 0.03, 0.04, 0.03); g.add(e); }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.08), new THREE.MeshStandardMaterial({ color: 0xe0333a })); tongue.position.set(0, -0.01, 0.08); g.add(tongue);
  return g;
}
function makeDino() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x6cc26a, roughness: 0.35 }), belly = new THREE.MeshStandardMaterial({ color: 0xd8ee9a, roughness: 0.4 });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; g.add(me); return me; };
  add(new THREE.SphereGeometry(0.45, 20, 16), m, 0, 0.9, 0, 0.9, 1.1, 0.8);
  add(new THREE.SphereGeometry(0.32, 16, 12), belly, 0, 0.85, 0.22, 0.8, 1, 0.5);
  add(new THREE.SphereGeometry(0.3, 18, 14), m, 0, 1.65, 0.2, 1, 0.85, 1.3);
  add(new THREE.SphereGeometry(0.2, 14, 10), m, 0, 1.55, 0.5, 1, 0.6, 1);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }), s * 0.14, 1.78, 0.38);
    add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }), s * 0.14, 1.79, 0.44);
    add(new THREE.CapsuleGeometry(0.1, 0.35, 4, 8), m, s * 0.22, 0.25, 0);
    add(new THREE.CapsuleGeometry(0.05, 0.15, 4, 8), m, s * 0.32, 1.1, 0.3).rotation.x = -1;
  }
  for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.07, 0.15, 8), belly, 0, 1.9 - i * 0.28, -0.1 - i * 0.12);
  add(new THREE.ConeGeometry(0.2, 0.8, 12), m, 0, 0.6, -0.6).rotation.x = -1.9;
  return g;
}

// ======================= 2D screen drawings =======================
function drawBug(g, x, y, t, s) {
  g.save(); g.translate(x, y); g.rotate(Math.sin(t) * 0.3); g.scale(s, s);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
  for (let i = -1; i <= 1; i++) for (const d of [-1, 1]) { g.beginPath(); g.moveTo(0, i * 8); g.lineTo(d * 22, i * 10 + Math.sin(t * 8 + i) * 5); g.stroke(); }
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(0, 0, 14, 20, 0, 0, 7); g.fill();
  g.fillStyle = '#5a4030'; g.beginPath(); g.arc(0, -20, 9, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -23, 3, 0, 7); g.arc(4, -23, 3, 0, 7); g.fill();
  g.restore();
}
function drawGoofyFace(g, x, y, r, t) {
  g.fillStyle = 'rgba(30,24,20,0.85)'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.38, y - r * 0.2, r * 0.26, 0, 7); g.arc(x + r * 0.38, y - r * 0.25, r * 0.3, 0, 7); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(x - r * 0.38 + Math.sin(t * 7) * r * 0.1, y - r * 0.2, r * 0.1, 0, 7); g.arc(x + r * 0.38 + Math.cos(t * 7) * r * 0.1, y - r * 0.25, r * 0.12, 0, 7); g.fill();
  g.fillStyle = '#7a2020'; g.beginPath(); g.ellipse(x, y + r * 0.38, r * 0.45, r * 0.3, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#ff7f8f'; g.beginPath(); g.ellipse(x + r * 0.1, y + r * 0.55, r * 0.18, r * 0.25, 0, 0, 7); g.fill();
  g.fillStyle = '#f4c35a'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('SURPRISE!', 256, 300); g.textAlign = 'left';
}
function drawCowTV(g, w, h, t) {
  g.fillStyle = `hsl(${(t * 120) % 360}, 70%, 60%)`; g.fillRect(0, 0, w, h);
  const x = w / 2 + Math.sin(t * 6) * 60, y = h / 2 + 20 + Math.abs(Math.sin(t * 12)) * -20;
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y + 30, 90, 60, 0, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.ellipse(x - 30, y + 20, 25, 18, 0.4, 0, 7); g.ellipse(x + 40, y + 45, 20, 14, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - 45, 45, 0, 7); g.fill();
  g.fillStyle = '#f2a7b0'; g.beginPath(); g.ellipse(x, y - 25, 32, 20, 0, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(x - 16, y - 58, 7, 0, 7); g.arc(x + 16, y - 58, 7, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = '900 48px sans-serif'; g.textAlign = 'center'; g.strokeStyle = '#222'; g.lineWidth = 8;
  g.strokeText('MOO! ♪', w / 2, 52); g.fillText('MOO! ♪', w / 2, 52); g.textAlign = 'left';
}
function drawBooMirror(g, w, h, k, t) {
  g.globalAlpha = k; g.strokeStyle = '#6b4a3a'; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.32, h * 0.62); g.quadraticCurveTo(w * 0.42, h * 0.52, w * 0.5, h * 0.6); g.quadraticCurveTo(w * 0.58, h * 0.52, w * 0.68, h * 0.62); g.stroke();
  g.fillStyle = '#d0453a'; g.font = '900 96px sans-serif'; g.textAlign = 'center'; g.fillText('BOO!', w / 2 + Math.sin(t * 20) * 3, h * 0.38); g.textAlign = 'left';
  g.globalAlpha = 1;
}
