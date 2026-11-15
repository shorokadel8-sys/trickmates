// TRICKMATES — Omar & Shorok: procedural stylized rigs with facial expressions + animation state machine.
// Optional: drop rigged models at /assets/models/omar.glb and /assets/models/shorok.glb to override.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LOOK = {
  omar: {
    skin: 0xefbd98, shirt: 0x7499dc, pants: 0x2f3542, shoes: 0x3a2a22, hair: 0x5a3a22, iris: 0x7a4a22,
    brows: 0x4b3020, lip: 0xb5655a, hijab: null, sleeve: 'short',
  },
  shorok: {
    skin: 0xf4bc94, shirt: 0xe0c3a2, pants: 0xb0896a, shoes: 0x7a5a44, hair: null, iris: 0x5f9a4a,
    brows: 0x5a3a26, lip: 0xc86a62, hijab: 0xefdcc4, hijab2: 0xd8bd9c, sleeve: 'long',
  },
};

// emotion -> face parameters
const FACE = {
  neutral:     { eye: 1.0,  open: 0.95, browY: 0,      tilt: 0.05,  mouth: 'smile', blush: 0.15, look: 0 },
  happy:       { eye: 1.0,  open: 0.9,  browY: 0.005,  tilt: 0.08,  mouth: 'smile', blush: 0.25, look: 0 },
  laughing:    { eye: 1.0,  open: 0.18, browY: 0.012,  tilt: 0.15,  mouth: 'grin',  blush: 0.45, look: 0 },
  angry:       { eye: 0.95, open: 0.7,  browY: -0.022, tilt: -0.5,  mouth: 'teeth', blush: 0.35, look: 0 },
  sad:         { eye: 1.0,  open: 0.72, browY: 0.0,    tilt: 0.5,   mouth: 'frown', blush: 0.1,  look: 0 },
  surprised:   { eye: 1.25, open: 1.15, browY: 0.04,   tilt: 0.12,  mouth: 'o',     blush: 0.15, look: 0 },
  scared:      { eye: 1.2,  open: 1.1,  browY: 0.03,   tilt: 0.55,  mouth: 'wavy',  blush: 0.05, look: 0 },
  sneaky:      { eye: 1.0,  open: 0.55, browY: -0.006, tilt: -0.22, mouth: 'smirk', blush: 0.2,  look: 0.35 },
  embarrassed: { eye: 1.0,  open: 0.7,  browY: 0.012,  tilt: 0.4,   mouth: 'flat',  blush: 0.9,  look: -0.35 },
};
export const EMOTIONS = Object.keys(FACE);

// emotion played by a reaction animation
export const ANIM_EMOTION = {
  surprised: 'surprised', scared: 'scared', laugh: 'laughing', angry: 'angry', sad: 'sad',
  embarrassed: 'embarrassed', victory: 'laughing', prepare: 'sneaky', search: 'sneaky',
};

function mouthCanvas(kind, lip) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  const col = '#' + lip.toString(16).padStart(6, '0');
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#5a2a22'; g.lineWidth = 7;
  const dark = '#5b1e1e', teeth = '#fffaf2', tongue = '#d9706a';
  switch (kind) {
    case 'smile': g.beginPath(); g.moveTo(30, 34); g.quadraticCurveTo(64, 62, 98, 34); g.stroke(); break;
    case 'grin':
      g.fillStyle = dark; g.beginPath(); g.moveTo(22, 26); g.quadraticCurveTo(64, 30, 106, 26); g.quadraticCurveTo(64, 92, 22, 26); g.fill();
      g.fillStyle = teeth; g.beginPath(); g.moveTo(26, 28); g.quadraticCurveTo(64, 32, 102, 28); g.lineTo(96, 38); g.quadraticCurveTo(64, 42, 32, 38); g.fill();
      g.fillStyle = tongue; g.beginPath(); g.ellipse(64, 60, 18, 8, 0, 0, 7); g.fill(); break;
    case 'o': g.fillStyle = dark; g.beginPath(); g.ellipse(64, 42, 16, 22, 0, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 5; g.stroke(); break;
    case 'teeth':
      g.fillStyle = teeth; g.beginPath(); g.roundRect(28, 30, 72, 20, 8); g.fill(); g.strokeStyle = '#5a2a22'; g.lineWidth = 5; g.stroke();
      g.beginPath(); g.moveTo(30, 40); g.lineTo(98, 40); g.lineWidth = 2; g.stroke(); break;
    case 'frown': g.beginPath(); g.moveTo(34, 52); g.quadraticCurveTo(64, 26, 94, 52); g.stroke(); break;
    case 'wavy':
      g.fillStyle = dark; g.beginPath(); g.moveTo(26, 40); g.quadraticCurveTo(45, 24, 64, 34); g.quadraticCurveTo(83, 24, 102, 40); g.quadraticCurveTo(64, 64, 26, 40); g.fill();
      g.fillStyle = teeth; g.fillRect(40, 32, 48, 7); break;
    case 'smirk': g.beginPath(); g.moveTo(36, 42); g.quadraticCurveTo(70, 50, 100, 28); g.stroke(); break;
    case 'flat': g.beginPath(); g.moveTo(38, 42); g.quadraticCurveTo(50, 36, 64, 42); g.quadraticCurveTo(78, 48, 90, 40); g.stroke(); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Character {
  constructor(kind, scene) {
    this.kind = kind;
    this.look = LOOK[kind];
    this.root = new THREE.Group();
    this.root.name = kind;
    scene.add(this.root);
    this.mats = [];
    this.anim = 'idle';
    this.animTime = 0;
    this.emotion = 'happy';
    this.overrideEmotion = null;
    this.face = { ...FACE.happy };
    this.phase = 0;
    this.blinkT = 2 + Math.random() * 2;
    this.tint = { color: new THREE.Color(1, 1, 1), amt: 0 };
    this.pose = {};
    this.build();
    this.tryLoadGLB();
  }

  m(color, rough = 0.75, extra = {}) {
    const mm = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    mm.userData.base = new THREE.Color(color);
    this.mats.push(mm); return mm;
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
  }
  capsule(r, len, mat, parent, x, y, z) { return this.mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat, parent, x, y, z); }

  build() {
    const L = this.look;
    const skin = this.m(L.skin, 0.6), shirt = this.m(L.shirt, 0.85), pants = this.m(L.pants, 0.85), shoes = this.m(L.shoes, 0.6);
    this.body = new THREE.Group(); this.root.add(this.body);
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.11, 0.86, 0); this.body.add(hip);
      this.capsule(0.085, 0.36, pants, hip, 0, -0.24, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      this.capsule(0.075, 0.3, pants, knee, 0, -0.2, 0);
      const shoe = this.mesh(new RoundedBoxGeometry(0.15, 0.1, 0.26, 2, 0.045), shoes, knee, 0, -0.39, 0.04);
      this.legs.push({ hip, knee, shoe, s });
    }
    // torso
    this.torso = new THREE.Group(); this.torso.position.y = 0.88; this.body.add(this.torso);
    this.mesh(new THREE.SphereGeometry(0.2, 18, 12), pants, this.torso, 0, 0.02, 0).scale.set(1.15, 0.6, 0.85);
    const chest = this.capsule(0.21, 0.32, shirt, this.torso, 0, 0.32, 0); chest.scale.set(1.08, 1, 0.78);
    if (this.kind === 'shorok') { // long tunic
      const tunic = this.mesh(new THREE.CylinderGeometry(0.23, 0.29, 0.42, 20, 1, true), shirt, this.torso, 0, 0.0, 0);
      tunic.scale.z = 0.8; tunic.material.side = THREE.DoubleSide;
    }
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.27, 0.55, 0); this.torso.add(sh);
      this.mesh(new THREE.SphereGeometry(0.09, 12, 10), shirt, sh, 0, 0, 0);
      this.capsule(0.068, 0.2, L.sleeve === 'short' ? shirt : shirt, sh, 0, -0.15, 0);
      const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
      this.capsule(0.058, 0.2, L.sleeve === 'short' ? skin : shirt, el, 0, -0.13, 0);
      if (L.sleeve === 'long') this.mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.06, 12), this.m(L.hijab2 || L.shirt), el, 0, -0.24, 0);
      const hand = this.mesh(new THREE.SphereGeometry(0.068, 14, 10), skin, el, 0, -0.29, 0.01);
      hand.scale.set(0.9, 1.05, 0.8);
      this.arms.push({ sh, el, hand, s });
    }
    // neck + head
    this.capsule(0.07, 0.08, skin, this.torso, 0, 0.66, 0);
    this.headPivot = new THREE.Group(); this.headPivot.position.set(0, 0.78, 0.01); this.torso.add(this.headPivot);
    this.head = new THREE.Group(); this.head.position.y = 0.2; this.headPivot.add(this.head);
    const R = 0.24; this.R = R;
    const skull = this.mesh(new THREE.SphereGeometry(R, 32, 24), skin, this.head); skull.scale.set(1, 1.08, 1);
    this.mesh(new THREE.SphereGeometry(0.19, 20, 14), skin, this.head, 0, -0.1, 0.03).scale.set(1, 0.9, 1.02); // cheeks/jaw
    this.mesh(new THREE.SphereGeometry(0.035, 12, 10), skin, this.head, 0, -0.025, R * 0.99).scale.set(1, 1.1, 1.1); // nose
    if (this.kind === 'omar') for (const s of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.05, 10, 8), skin, this.head, s * R * 0.98, -0.01, -0.01).scale.set(0.5, 1, 0.8);
    this.buildFace();
    if (this.kind === 'omar') this.buildOmarHair(); else this.buildHijab();
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  buildFace() {
    const L = this.look, R = this.R;
    const white = this.m(0xffffff, 0.2), iris = this.m(L.iris, 0.3), pupil = this.m(0x111111, 0.2), brow = this.m(L.brows, 0.9);
    const lid = this.m(L.skin, 0.6);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.085, 0.035, R * 0.86); this.head.add(eg);
      const ball = this.mesh(new THREE.SphereGeometry(0.058, 20, 16), white, eg); ball.scale.set(1, 1.08, 0.62); ball.castShadow = false;
      const ir = new THREE.Group(); eg.add(ir);
      const irisM = this.mesh(new THREE.CircleGeometry(0.034, 24), iris, ir, 0, 0, 0.037); irisM.castShadow = false;
      const pu = this.mesh(new THREE.CircleGeometry(0.017, 16), pupil, ir, 0, 0, 0.0375); pu.castShadow = false;
      const hl = this.mesh(new THREE.CircleGeometry(0.008, 10), this.m(0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 }), ir, 0.012, 0.012, 0.038); hl.castShadow = false;
      // upper eyelid: skin-coloured half shell that rotates down to close
      const lidG = new THREE.Group(); eg.add(lidG);
      const lm = this.mesh(new THREE.SphereGeometry(0.062, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lid, lidG); lm.scale.set(1.02, 1.1, 0.68); lm.castShadow = false;
      lidG.rotation.x = -1.4;
      const browM = this.mesh(new RoundedBoxGeometry(0.085, 0.022, 0.025, 2, 0.01), brow, this.head, s * 0.088, 0.115, R * 0.9);
      browM.rotation.y = s * 0.25; browM.castShadow = false;
      this.eyes.push({ g: eg, ir, lid: lidG, brow: browM, s });
    }
    // blush
    this.blush = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: 0xf08a8a, transparent: true, opacity: 0.2, depthWrite: false }));
      b.position.set(s * 0.13, -0.045, R * 0.84); b.rotation.y = s * 0.55; this.head.add(b); this.blush.push(b);
    }
    // mouth (canvas-swapped)
    this.mouthTex = {};
    for (const k of ['smile', 'grin', 'o', 'teeth', 'frown', 'wavy', 'smirk', 'flat']) this.mouthTex[k] = mouthCanvas(k, L.lip);
    this.mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.094), new THREE.MeshBasicMaterial({ map: this.mouthTex.smile, transparent: true, depthWrite: false }));
    this.mouth.position.set(0, -0.105, 0.234); this.mouth.rotation.x = 0.15; this.head.add(this.mouth);
    this.mouth.renderOrder = 2;
  }

  buildOmarHair() {
    const hair = this.m(this.look.hair, 0.85), R = this.R;
    const add = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const me = this.mesh(new THREE.SphereGeometry(r, 16, 12), hair, this.head, x, y, z); me.scale.set(sx, sy, sz); return me; };
    add(R * 1.04, 0, 0.07, -0.025, 1.0, 0.82, 1.0);   // cap
    add(0.11, 0.06, 0.22, 0.1, 1.3, 0.8, 1.0);         // quiff
    add(0.09, -0.08, 0.2, 0.12, 1.1, 0.7, 0.9);
    add(0.08, 0.15, 0.17, 0.06, 1, 0.8, 1);
    add(0.08, -0.16, 0.16, 0.04, 1, 0.8, 1);
    add(0.06, 0.13, 0.2, 0.15, 1.1, 0.6, 0.9);
    for (const s of [-1, 1]) add(0.05, s * R * 0.93, 0.02, 0.02, 0.5, 1.3, 0.8);   // sideburns
    // hide face area of cap: push skin forward via cap offset above; add facial hair
    const beard = this.m(0x5a3a22, 0.95);
    const goatee = this.mesh(new THREE.SphereGeometry(0.075, 16, 12), beard, this.head, 0, -0.205, 0.165); goatee.scale.set(1.15, 0.75, 0.6);
    const soul = this.mesh(new THREE.SphereGeometry(0.02, 10, 8), beard, this.head, 0, -0.155, 0.214); soul.scale.set(1.2, 0.8, 0.5);
    for (const s of [-1, 1]) {
      const mus = this.mesh(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8), beard, this.head, s * 0.04, -0.072, 0.228);
      mus.rotation.z = s * 1.25; mus.rotation.y = s * 0.3;
    }
  }

  buildHijab() {
    const L = this.look, R = this.R;
    const fab = this.m(L.hijab, 0.95, { side: THREE.DoubleSide });
    const fab2 = this.m(L.hijab2, 0.95, { side: THREE.DoubleSide });
    const HR = R * 1.18;
    const gap = 1.55;
    const g = new THREE.Group(); g.position.set(0, 0.03, -0.045); this.head.add(g);
    // top cap (covers forehead), sides with face opening, chin wrap
    this.mesh(new THREE.SphereGeometry(HR, 32, 12, 0, Math.PI * 2, 0, 0.78), fab, g);
    this.mesh(new THREE.SphereGeometry(HR, 32, 16, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0.76, 1.6), fab, g);
    this.mesh(new THREE.SphereGeometry(HR, 32, 8, 0, Math.PI * 2, 2.3, 0.85), fab, g);
    // face-framing fold
    const fold = this.mesh(new THREE.TorusGeometry(0.17, 0.028, 10, 32), fab2, this.head, 0, -0.005, 0.15);
    fold.scale.set(0.95, 1.22, 1);
    // drape over shoulders/chest (layered)
    const prof = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.12 + t * t * 0.24 + Math.sin(t * 9) * 0.008, 0.02 - t * 0.42)); }
    const drape = this.mesh(new THREE.LatheGeometry(prof, 28), fab, this.torso, 0, 0.73, 0); drape.scale.z = 0.82;
    const drape2 = this.mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p.x * 0.9, p.y * 0.8)), 28), fab2, this.torso, 0, 0.74, 0.02); drape2.scale.set(1.02, 1, 0.86);
  }

  async tryLoadGLB() {
    try {
      const url = `/assets/models/${this.kind}.glb`;
      const list = await (await fetch('/models.json')).json();
      if (!list.includes(`${this.kind}.glb`)) return;
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      this.body.visible = false;
      const model = gltf.scene; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.root.add(model);
      this.mixer = new THREE.AnimationMixer(model);
      this.clips = Object.fromEntries(gltf.animations.map(a => [a.name.toLowerCase(), this.mixer.clipAction(a)]));
      this.glbAction = null;
    } catch (e) { /* fall back to procedural rig */ }
  }

  setAnim(a) { if (a !== this.anim) { this.anim = a; this.animTime = 0; } }
  setEmotion(e) { if (FACE[e]) this.emotion = e; }
  flash(color, amt = 1) { this.tint.color.set(color); this.tint.amt = amt; }

  update(dt, speed01 = 0) {
    this.animTime += dt;
    const a = this.anim, t = this.animTime;
    if (this.mixer) {
      const map = { walk: 'walk', run: 'run', idle: 'idle', laugh: 'laugh', stunned: 'scared' };
      const want = this.clips[(map[a] || a)] || this.clips.idle;
      if (want && want !== this.glbAction) { if (this.glbAction) this.glbAction.fadeOut(0.2); want.reset().fadeIn(0.2).play(); this.glbAction = want; }
      this.mixer.update(dt);
    }
    // ----- body pose targets -----
    const P = { hipY: 0, lean: 0, twist: 0, headX: 0, headY: 0, headZ: 0, jump: 0, legA: [0, 0], kneeA: [0, 0], armX: [0, 0], armZ: [0.12, 0.12], elbow: [-0.15, -0.15], spin: 0 };
    let freq = 0;
    if (a === 'walk' || a === 'run') {
      freq = a === 'run' ? 13 : 8.5;
      this.phase += dt * freq;
      const amp = a === 'run' ? 0.85 : 0.55, ph = this.phase;
      P.legA = [Math.sin(ph) * amp, -Math.sin(ph) * amp];
      P.kneeA = [Math.max(0, -Math.cos(ph)) * amp * 1.2, Math.max(0, Math.cos(ph)) * amp * 1.2];
      P.armX = [-Math.sin(ph) * amp * 0.9, Math.sin(ph) * amp * 0.9];
      P.elbow = [-0.4 - (a === 'run' ? 0.7 : 0), -0.4 - (a === 'run' ? 0.7 : 0)];
      P.jump = Math.abs(Math.sin(ph)) * (a === 'run' ? 0.07 : 0.035);
      P.lean = a === 'run' ? 0.18 : 0.05;
    } else if (a === 'idle') {
      P.jump = Math.sin(t * 2) * 0.008; P.headZ = Math.sin(t * 0.7) * 0.04; P.armZ = [0.12 + Math.sin(t * 2) * 0.02, 0.12 + Math.sin(t * 2) * 0.02];
    } else if (a === 'interact') {
      P.armX = [-1.1 + Math.sin(t * 9) * 0.15, -1.1 - Math.sin(t * 9) * 0.15]; P.elbow = [-0.5, -0.5]; P.lean = 0.12; P.headX = 0.25;
    } else if (a === 'prepare') {
      P.hipY = -0.22; P.kneeA = [1.0, 1.0]; P.legA = [-0.55, -0.55]; P.lean = 0.35;
      P.armX = [-1.0 + Math.sin(t * 12) * 0.2, -1.0 + Math.cos(t * 12) * 0.2]; P.elbow = [-0.8, -0.8];
      P.headY = Math.sin(t * 1.6) * 0.6; P.headX = 0.1;
    } else if (a === 'search') {
      P.hipY = -0.1; P.kneeA = [0.5, 0.5]; P.legA = [-0.25, -0.25]; P.lean = 0.3; P.headY = Math.sin(t * 4) * 0.7; P.headX = 0.3;
      P.armX = [-0.8, -0.3]; P.elbow = [-0.6, -0.2];
    } else if (a === 'surprised') {
      const k = Math.max(0, 1 - t * 2.5); P.jump = Math.sin(Math.min(t * 6, Math.PI)) * 0.25 * (t < 0.5 ? 1 : 0);
      P.lean = -0.25; P.armX = [-0.6, -0.6]; P.armZ = [1.1, 1.1]; P.elbow = [-0.6, -0.6]; P.headX = -0.2 + k * 0.1;
    } else if (a === 'scared') {
      const sh = Math.sin(t * 40) * 0.05;
      P.jump = t < 0.45 ? Math.sin(t / 0.45 * Math.PI) * 0.4 : 0;
      P.lean = -0.2 + sh; P.twist = sh; P.armX = [-2.6, -2.6]; P.armZ = [0.5, 0.5]; P.elbow = [-1.2, -1.2];
      P.headX = -0.15; P.headZ = sh * 2; P.kneeA = [0.3, 0.3];
    } else if (a === 'laugh') {
      P.jump = Math.abs(Math.sin(t * 9)) * 0.05; P.lean = -0.2 + Math.sin(t * 9) * 0.06; P.headX = -0.35;
      P.armX = [-0.6, -0.6]; P.armZ = [-0.3, -0.3]; P.elbow = [-1.6, -1.6];
    } else if (a === 'angry') {
      P.jump = Math.max(0, Math.sin(t * 10)) * 0.05; P.legA = [Math.max(0, Math.sin(t * 10)) * 0.4, 0]; P.kneeA = [Math.max(0, Math.sin(t * 10)) * 0.5, 0];
      P.armX = [-0.3, -0.3]; P.armZ = [0.4, 0.4]; P.elbow = [-1.4, -1.4]; P.lean = 0.12; P.headX = 0.15; P.headZ = Math.sin(t * 14) * 0.08;
    } else if (a === 'sad') {
      P.lean = 0.2; P.headX = 0.45; P.armZ = [0.05, 0.05]; P.hipY = -0.03;
    } else if (a === 'embarrassed') {
      P.armX = [-2.3, -2.3]; P.armZ = [-0.35, -0.35]; P.elbow = [-1.9, -1.9]; P.headX = 0.25; P.headZ = 0.25; P.twist = Math.sin(t * 3) * 0.15;
    } else if (a === 'victory') {
      P.jump = Math.abs(Math.sin(t * 5)) * 0.35; P.armX = [-2.9, -2.9]; P.armZ = [0.4, 0.4]; P.elbow = [-0.2, -0.2]; P.spin = t * 4; P.headX = -0.2;
    }
    // ----- apply with smoothing -----
    const k = 14;
    const S = this.pose;
    const lerpKey = (key, v) => { S[key] = S[key] === undefined ? v : damp(S[key], v, k, dt); return S[key]; };
    this.body.position.y = lerpKey('hipY', P.hipY) + P.jump;
    this.body.rotation.x = lerpKey('lean', P.lean);
    this.body.rotation.y = P.spin ? P.spin : lerpKey('twist', P.twist);
    this.headPivot.rotation.x = lerpKey('headX', P.headX);
    this.headPivot.rotation.y = lerpKey('headY', P.headY);
    this.headPivot.rotation.z = lerpKey('headZ', P.headZ);
    this.legs.forEach((l, i) => { l.hip.rotation.x = lerpKey('leg' + i, P.legA[i]); l.knee.rotation.x = lerpKey('knee' + i, P.kneeA[i]); });
    this.arms.forEach((ar, i) => {
      ar.sh.rotation.x = lerpKey('armX' + i, P.armX[i]);
      ar.sh.rotation.z = ar.s * lerpKey('armZ' + i, P.armZ[i]);
      ar.el.rotation.x = lerpKey('elb' + i, P.elbow[i]);
    });
    // ----- face -----
    const emo = this.overrideEmotion || ANIM_EMOTION[a] || this.emotion;
    const F = FACE[emo] || FACE.happy;
    const f = this.face;
    for (const key of ['eye', 'open', 'browY', 'tilt', 'blush', 'look']) f[key] = damp(f[key], F[key], 12, dt);
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0) { blink = 0.05; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3; }
    const open = Math.min(1.2, f.open * blink);
    for (const e of this.eyes) {
      e.g.scale.setScalar(f.eye);
      e.lid.rotation.x = -1.4 + (1 - Math.min(open, 1)) * 2.9;
      e.ir.position.x = f.look * 0.02;
      e.brow.position.y = 0.115 + f.browY + (f.eye - 1) * 0.06;
      e.brow.rotation.z = -e.s * f.tilt * 0.6;
    }
    if (this.mouth.material.map !== this.mouthTex[F.mouth]) this.mouth.material.map = this.mouthTex[F.mouth];
    for (const b of this.blush) b.material.opacity = f.blush * 0.75;
    // ----- tint (flour / water) -----
    if (this.tint.amt > 0.001) {
      this.tint.amt = Math.max(0, this.tint.amt - dt * 0.18);
      for (const mm of this.mats) mm.color.copy(mm.userData.base).lerp(this.tint.color, this.tint.amt * 0.8);
    }
  }

  headWorld(target = new THREE.Vector3()) { return this.head.getWorldPosition(target); }
}
