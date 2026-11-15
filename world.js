// TRICKMATES — procedural cozy 3D house (5 rooms) matching the cutaway reference
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOMS, WALLS, WALL_T, HOTSPOTS } from '/shared/data.js';

// ---------- canvas textures ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

function woodTex(base, rx, rz) {
  return canvasTex(512, 512, (g, w, h) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(0, 300);
      while (x < w) {
        const len = rnd(180, 340);
        const l = rnd(-10, 10);
        g.fillStyle = `hsl(${base[0] + rnd(-3, 3)}, ${base[1]}%, ${base[2] + l}%)`;
        g.fillRect(x, r * rh, len, rh);
        g.strokeStyle = 'rgba(60,30,10,0.12)';
        for (let k = 0; k < 6; k++) {
          g.beginPath(); const y = r * rh + rnd(4, rh - 4);
          g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + rnd(-4, 4), x + len * 0.6, y + rnd(-4, 4), x + len, y + rnd(-3, 3));
          g.lineWidth = rnd(0.5, 1.6); g.stroke();
        }
        g.fillStyle = 'rgba(40,20,5,0.35)'; g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,5,0.3)'; g.fillRect(0, r * rh, w, 2);
    }
  }, [rx, rz]);
}
function tileTex(rx, rz) {
  return canvasTex(256, 256, (g, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(36, ${rnd(30, 40)}%, ${rnd(80, 86)}%)`; g.fillRect(i * s, j * s, s, s);
    }
    g.strokeStyle = 'rgba(150,120,90,0.55)'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }, [rx, rz]);
}
function rugTex(c1, c2) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0, 0.06)})`; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
    g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  });
}
function fabricTex(color) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${rnd(0.01, 0.05)})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${rnd(0.01, 0.05)})`; g.fillRect(x, 0, 1, h); }
  }, [2, 2]);
}
export function textCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c;
}

// ---------- materials ----------
const M = {};
function mat(key, color, o = {}) {
  if (!M[key]) M[key] = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, ...(o.extra || {}) });
  return M[key];
}

export class World {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.colliders = [];
    this.anchors = {};
    this.fx = {};
    this.lights = [];
    this.quality = quality;
    this.build();
  }

  // ---------- primitive helpers ----------
  box(w, h, d, material, x, y, z, o = {}) {
    const geo = o.round === 0 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, Math.min(o.round ?? 0.03, w / 2.1, h / 2.1, d / 2.1));
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = o.cast ?? true; m.receiveShadow = true;
    (o.parent || this.group).add(m);
    return m;
  }
  cyl(rt, rb, h, material, x, y, z, o = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20), material);
    m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = true;
    (o.parent || this.group).add(m); return m;
  }
  sphere(r, material, x, y, z, o = {}) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg || 18, o.seg2 || 14), material);
    m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = true;
    if (o.scale) m.scale.set(...o.scale);
    (o.parent || this.group).add(m); return m;
  }
  collider(cx, cz, w, d) { this.colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }); }
  plane(w, h, material, x, y, z, rx = 0, ry = 0, parent = this.group) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; parent.add(m); return m;
  }
  pointLight(color, intensity, dist, x, y, z) {
    if (this.quality === 'low' && this.lights.length >= 4) return null;
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z); this.group.add(l); this.lights.push(l); return l;
  }

  // ---------- build ----------
  build() {
    this.buildShell();
    this.buildOffice();
    this.buildKitchen();
    this.buildLiving();
    this.buildBedroom();
    this.buildBathroom();
    this.buildAnchors();
  }

  buildShell() {
    // base slab (cutaway section edge like the reference)
    const slab = this.box(26.6, 0.5, 17.6, mat('slab', 0x8a6a52, { r: 0.9 }), 0, -0.26, -0.5, { round: 0.05 });
    slab.castShadow = false;
    // missing corner (outside bathroom, east of x=9 south of z=0) is ground
    const ground = this.plane(140, 140, mat('ground', 0x5b4a40, { r: 1 }), 0, -0.52, 0, -Math.PI / 2);
    ground.receiveShadow = true;
    const cornerFill = this.box(4.2, 0.52, 8.2, mat('ground2', 0x5b4a40, { r: 1 }), 11.1, -0.25, 4.1, { round: 0 });
    cornerFill.castShadow = false;

    const floors = {
      wood: () => new THREE.MeshStandardMaterial({ map: woodTex([28, 48, 52], 1.6, 1.6), roughness: 0.62 }),
      woodLight: () => new THREE.MeshStandardMaterial({ map: woodTex([30, 45, 60], 2, 2), roughness: 0.65 }),
      tile: () => new THREE.MeshStandardMaterial({ map: tileTex(5, 5), roughness: 0.4 }),
    };
    for (const r of Object.values(ROOMS)) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const m = floors[r.floor]();
      m.map.repeat.set(w / 4, d / 4);
      const f = this.plane(w, d, m, (r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2, -Math.PI / 2);
      f.receiveShadow = true;
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeadccb, roughness: 0.95 });
    const capMat = mat('cap', 0xf8f2e8, { r: 0.9 });
    const baseMat = mat('baseboard', 0xf3ebe0, { r: 0.7 });
    for (const [x0, z0, x1, z1, h] of WALLS) {
      const horiz = z0 === z1;
      const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = horiz ? len + WALL_T : WALL_T, d = horiz ? WALL_T : len + WALL_T;
      this.box(w, h, d, wallMat, cx, h / 2, cz, { round: 0 });
      this.box(w + 0.02, 0.05, d + 0.02, capMat, cx, h + 0.02, cz, { round: 0, cast: false });
      if (h > 2) this.box(horiz ? w : WALL_T + 0.06, 0.12, horiz ? WALL_T + 0.06 : d, baseMat, cx, 0.06, cz, { round: 0, cast: false });
      this.collider(cx, cz, w, d);
    }
    // ceiling crown trim on full walls
    this.box(26.2, 0.1, 0.16, capMat, 0, 2.78, -8.88, { round: 0, cast: false });
    this.box(0.16, 0.1, 17, capMat, -12.88, 2.78, -0.5, { round: 0, cast: false });
    // outer bounds
    this.colliders.push({ x0: -20, x1: 20, z0: -20, z1: -9.05 });
    this.colliders.push({ x0: -20, x1: -13.05, z0: -20, z1: 20 });
  }

  // windows on full-height walls
  window(x, z, w, h, y, facing = 'north', curtains = true) {
    const glass = mat('glass', 0xfff1d6, { r: 0.2, extra: { emissive: 0xffe2b0, emissiveIntensity: 1.25 } });
    const frame = mat('frame', 0xfaf6ef, { r: 0.5 });
    const g = new THREE.Group(); g.position.set(x, y, z); this.group.add(g);
    if (facing === 'west') g.rotation.y = Math.PI / 2;
    this.box(w, h, 0.04, glass, 0, 0, 0.11, { parent: g, cast: false, round: 0 });
    this.box(w + 0.16, 0.08, 0.14, frame, 0, h / 2, 0.14, { parent: g });
    this.box(w + 0.16, 0.1, 0.2, frame, 0, -h / 2, 0.16, { parent: g });
    this.box(0.08, h, 0.14, frame, -w / 2, 0, 0.14, { parent: g });
    this.box(0.08, h, 0.14, frame, w / 2, 0, 0.14, { parent: g });
    this.box(0.05, h, 0.1, frame, 0, 0, 0.14, { parent: g });
    this.box(w, 0.05, 0.1, frame, 0, h * 0.12, 0.14, { parent: g });
    if (curtains) {
      const cm = new THREE.MeshStandardMaterial({ color: 0xf6eee2, roughness: 1, transparent: true, opacity: 0.93, map: fabricTex('#f6eee2') });
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h + 0.6, 12, 1, true), cm);
        c.scale.z = 0.35; c.position.set(s * (w / 2 + 0.12), -0.15, 0.3); c.castShadow = true; g.add(c);
      }
      this.cyl(0.02, 0.02, w + 0.9, mat('rod', 0xc9b79f, { r: 0.4, m: 0.6 }), 0, h / 2 + 0.25, 0.32, { parent: g }).rotation.z = Math.PI / 2;
    }
    return g;
  }

  frame(x, y, z, w, h, draw, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.group.add(g);
    this.box(w + 0.08, h + 0.08, 0.04, mat('pframe', 0x5b3b25, { r: 0.6 }), 0, 0, 0, { parent: g, round: 0.01 });
    const t = new THREE.CanvasTexture(textCanvas(256, Math.round(256 * h / w), draw)); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    p.position.z = 0.025; g.add(p);
    return g;
  }

  plant(x, z, s = 1, potColor = 0xe2d8cc) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); this.group.add(g);
    this.cyl(0.24, 0.18, 0.45, mat('pot' + potColor, potColor, { r: 0.6 }), 0, 0.225, 0, { parent: g });
    this.cyl(0.22, 0.22, 0.03, mat('soil', 0x3b2a1e), 0, 0.44, 0, { parent: g, cast: false });
    const leafA = mat('leafA', 0x4e8a3a, { r: 0.7 }), leafB = mat('leafB', 0x3a7330, { r: 0.7 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, rr = 0.12 + (i % 3) * 0.05;
      const leaf = this.sphere(0.13, i % 2 ? leafA : leafB, Math.cos(a) * rr, 0.75 + (i % 4) * 0.13, Math.sin(a) * rr, { parent: g, scale: [0.7, 1.5, 0.35], seg: 10, seg2: 8 });
      leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
    }
    this.cyl(0.015, 0.015, 0.5, leafB, 0, 0.65, 0, { parent: g });
    return g;
  }

  books(x, y, z, n, alongX = true, parent = this.group) {
    const cols = [0x2d4a6b, 0x8a3b2e, 0xd9c7a3, 0x3f5e45, 0xb98b4a, 0x1f2a3a, 0xe8dcc8, 0x6b4b3a];
    let off = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd(0.04, 0.07), h = rnd(0.22, 0.3);
      const m = mat('book' + (i % cols.length), cols[i % cols.length], { r: 0.7 });
      if (alongX) this.box(w, h, 0.18, m, x + off, y + h / 2, z, { parent, round: 0.008 });
      else this.box(0.18, h, w, m, x, y + h / 2, z + off, { parent, round: 0.008 });
      off += w + 0.005;
    }
  }

  screenTexture(w, h, draw) {
    const c = textCanvas(w, h, draw);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, tex: t };
  }

  // ---------- ROOM 1: HOME OFFICE ----------
  buildOffice() {
    const wood = mat('deskWood', 0xb07a4b, { r: 0.5 });
    const dark = mat('black', 0x2a2624, { r: 0.5 });
    // desk
    this.box(2.8, 0.07, 1.15, wood, -9.5, 0.76, -8.25);
    for (const dx of [-1.3, 1.3]) for (const dz of [-0.45, 0.45]) this.box(0.07, 0.74, 0.07, dark, -9.5 + dx, 0.37, -8.25 + dz);
    this.box(0.9, 0.5, 1.0, wood, -10.4, 0.45, -8.25); // drawer unit
    this.collider(-9.5, -8.25, 2.8, 1.15);
    // laptop (screen faces the player/camera)
    const lap = new THREE.Group(); lap.position.set(-9.5, 0.8, -8.15); this.group.add(lap);
    const alu = mat('alu', 0xc8cbd0, { r: 0.3, m: 0.7 });
    this.box(0.62, 0.025, 0.42, alu, 0, 0, 0.05, { parent: lap, round: 0.01 });
    const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.16); lid.rotation.x = -0.2; lap.add(lid);
    this.box(0.62, 0.4, 0.02, alu, 0, 0.2, 0, { parent: lid, round: 0.01 });
    const scr = this.screenTexture(512, 320, (g, w, h) => drawDesktop(g, w, h));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.position.set(0, 0.2, 0.012); lid.add(screen);
    this.fx.laptop = { screen, ...scr, redraw: () => { drawDesktop(scr.canvas.getContext('2d'), 512, 320); scr.tex.needsUpdate = true; } };
    // desk lamp (black, like reference)
    const lamp = new THREE.Group(); lamp.position.set(-10.6, 0.8, -8.5); this.group.add(lamp);
    this.cyl(0.12, 0.14, 0.04, dark, 0, 0.02, 0, { parent: lamp });
    const arm = this.cyl(0.015, 0.015, 0.6, dark, 0.08, 0.3, 0.05, { parent: lamp }); arm.rotation.z = -0.3;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2624, side: THREE.DoubleSide, roughness: 0.4 }));
    shade.position.set(0.25, 0.6, 0.15); shade.rotation.z = -0.9; lamp.add(shade);
    this.sphere(0.05, mat('bulb', 0xfff2d0, { extra: { emissive: 0xffd28a, emissiveIntensity: 3 } }), 0.31, 0.56, 0.15, { parent: lamp, cast: false });
    this.pointLight(0xffc27a, 3.2, 5, -10.3, 1.3, -7.9);
    // mug "Better Ideas Today"
    const mugTex = new THREE.CanvasTexture(textCanvas(256, 128, (g, w, h) => {
      g.fillStyle = '#1f2b4d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9e2d0'; g.font = 'italic bold 30px Georgia';
      g.textAlign = 'center'; g.fillText('Better', w * 0.5, 40); g.fillText('Ideas', w * 0.5, 74); g.fillText('Today', w * 0.5, 108);
    })); mugTex.colorSpace = THREE.SRGBColorSpace;
    const mug = this.cyl(0.07, 0.065, 0.16, new THREE.MeshStandardMaterial({ map: mugTex, roughness: 0.4 }), -8.75, 0.88, -7.95);
    mug.rotation.y = -Math.PI / 2;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), mat('mugh', 0x1f2b4d, { r: 0.4 })); handle.position.set(-8.67, 0.88, -7.95); this.group.add(handle);
    // cow plush (from reference)
    this.cowPlush(-8.4, 0.8, -8.1);
    // books "Design" stack
    this.box(0.5, 0.06, 0.34, mat('bk1', 0x5f8a96, { r: 0.7 }), -8.4, 0.83, -8.55);
    this.box(0.48, 0.06, 0.32, mat('bk2', 0x3b4d6b, { r: 0.7 }), -8.4, 0.89, -8.55);
    // pencil cup + notebook
    this.cyl(0.06, 0.06, 0.16, mat('pcup', 0x2d3a5a, { r: 0.5 }), -10.85, 0.88, -7.9);
    for (let i = 0; i < 5; i++) this.cyl(0.008, 0.008, 0.22, mat('pen' + (i % 3), [0xd9a441, 0x3a6b3f, 0x1f1f1f][i % 3]), -10.85 + rnd(-0.03, 0.03), 0.98, -7.9 + rnd(-0.03, 0.03), { cast: false });
    this.box(0.36, 0.02, 0.26, mat('note', 0xf5f0e6), -10.05, 0.8, -7.85, { round: 0.005 });
    // office chair (mesh chair, rolls)
    const chair = new THREE.Group(); chair.position.set(-9.5, 0, -6.9); this.group.add(chair);
    this.box(0.58, 0.1, 0.55, dark, 0, 0.5, 0, { parent: chair });
    this.box(0.56, 0.7, 0.08, mat('mesh', 0x33302e, { r: 0.9 }), 0, 0.95, 0.27, { parent: chair });
    this.cyl(0.03, 0.03, 0.4, mat('chrome', 0x9a9a9a, { r: 0.3, m: 0.8 }), 0, 0.27, 0, { parent: chair });
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = this.box(0.35, 0.04, 0.05, dark, Math.cos(a) * 0.17, 0.07, Math.sin(a) * 0.17, { parent: chair }); leg.rotation.y = -a; }
    this.fx.chair = chair;
    // bookshelf (west wall)
    const sh = new THREE.Group(); sh.position.set(-12.72, 0, -4.2); this.group.add(sh);
    const shelfWood = mat('shelfWood', 0x8f5f38, { r: 0.6 });
    this.box(0.42, 2.0, 0.05, shelfWood, 0, 1.0, -1.1, { parent: sh, round: 0.01 });
    this.box(0.42, 2.0, 0.05, shelfWood, 0, 1.0, 1.1, { parent: sh, round: 0.01 });
    this.box(0.04, 2.0, 2.2, shelfWood, -0.19, 1.0, 0, { parent: sh, round: 0 });
    for (let i = 0; i < 5; i++) {
      this.box(0.42, 0.04, 2.2, shelfWood, 0, 0.05 + i * 0.48, 0, { parent: sh, round: 0.01 });
      if (i < 4) { const g = new THREE.Group(); g.position.set(0, 0.07 + i * 0.48, -1.0); sh.add(g); this.books(0, 0, 0, 10 + (i % 3) * 3, false, g); }
    }
    const honkBook = this.box(0.2, 0.3, 0.08, mat('redBook', 0xc0392b, { r: 0.6 }), 0.0, 1.13, 0.85, { parent: sh, round: 0.01 });
    this.fx.honkBook = honkBook;
    this.collider(-12.72, -4.2, 0.5, 2.3);
    // wall decor: "Good Things Take Time" poster, abstract frame, shelf, sticky note
    this.frame(-11.6, 1.85, -8.88, 0.9, 1.15, (g, w, h) => {
      g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b2b2b'; g.font = 'italic 46px "Segoe Script", "Brush Script MT", cursive';
      g.textAlign = 'center'; ['Good', 'Things', 'Take', 'Time'].forEach((s, i) => g.fillText(s, w / 2, 70 + i * 62));
      g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h - 50, 18, 0.2, Math.PI - 0.2); g.stroke();
      g.fillRect(w / 2 - 10, h - 64, 5, 5); g.fillRect(w / 2 + 6, h - 64, 5, 5);
    });
    this.frame(-7.0, 1.9, -8.88, 0.85, 1.0, (g, w, h) => {
      g.fillStyle = '#f3ece2'; g.fillRect(0, 0, w, h);
      [['#e9a99a', 110, 110, 62], ['#d9786a', 150, 150, 55], ['#f0c2a8', 120, 195, 50]].forEach(([c, x, y, r]) => { g.globalAlpha = 0.85; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    });
    const note = this.box(0.22, 0.22, 0.01, mat('sticky', 0xf7d66a, { r: 0.9 }), -6.3, 1.55, -8.88, { round: 0 }); note.rotation.z = 0.08;
    this.box(1.6, 0.05, 0.25, shelfWood, -9.4, 1.75, -8.78);
    this.books(-10.1, 1.78, -8.78, 12);
    this.plant(-8.4, -8.78, 0.35).position.y = 1.78;
    this.plant(-5.8, -8.35, 1.15, 0xd9cfc2); this.collider(-5.8, -8.35, 0.6, 0.6);
    // rug
    this.plane(3.4, 2.4, new THREE.MeshStandardMaterial({ map: rugTex('#cdb8a0', '#b39a80'), roughness: 1 }), -9.5, 0.01, -6.4, -Math.PI / 2);
    this.window(-12.86, -1.6, 1.6, 1.4, 1.6, 'west');
  }

  cowPlush(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -0.5; this.group.add(g);
    const white = mat('cowW', 0xf4f1ec, { r: 0.9 }), black = mat('cowB', 0x2b2b2b, { r: 0.9 }), pink = mat('cowP', 0xf2a7b0, { r: 0.8 });
    this.sphere(0.13, white, 0, 0.13, 0, { parent: g, scale: [1, 0.9, 1.2] });
    this.sphere(0.06, black, 0.08, 0.18, -0.05, { parent: g });
    this.sphere(0.11, white, 0, 0.3, 0.1, { parent: g });
    this.sphere(0.07, pink, 0, 0.26, 0.19, { parent: g, scale: [1.2, 0.8, 0.8] });
    for (const s of [-1, 1]) {
      this.sphere(0.02, black, s * 0.045, 0.34, 0.19, { parent: g });
      const horn = this.cyl(0.005, 0.015, 0.05, mat('horn', 0xe8d8b0), s * 0.06, 0.41, 0.08, { parent: g }); horn.rotation.z = -s * 0.4;
      this.sphere(0.035, pink, s * 0.12, 0.35, 0.08, { parent: g, scale: [1.4, 0.6, 0.8] });
      for (const fz of [-0.07, 0.07]) this.cyl(0.03, 0.03, 0.08, white, s * 0.07, 0.03, fz, { parent: g });
    }
    return g;
  }

  // ---------- ROOM 2: KITCHEN ----------
  buildKitchen() {
    const cab = mat('cabinet', 0xb5733f, { r: 0.55 });
    const top = mat('counterTop', 0xf1e8da, { r: 0.35 });
    const steel = mat('steel', 0xcfd2d6, { r: 0.28, m: 0.85 });
    const knob = mat('knob', 0xc8a26a, { r: 0.3, m: 0.8 });
    // base cabinets along the back wall
    const segs = [[-3.55, -2.0], [-0.6, 1.0], [2.6, 3.85]];
    for (const [a, b] of segs) {
      const w = b - a, cx = (a + b) / 2;
      this.box(w, 0.86, 0.62, cab, cx, 0.43, -8.58);
      for (let x = a + 0.3; x < b - 0.1; x += 0.6) { this.box(0.52, 0.7, 0.02, mat('cabFace', 0xbf7d48, { r: 0.5 }), x, 0.45, -8.26, { round: 0.01 }); this.box(0.12, 0.02, 0.03, knob, x, 0.72, -8.24); }
    }
    this.box(7.45, 0.05, 0.68, top, 0.13, 0.885, -8.57, { round: 0.01 });
    this.collider(0.13, -8.6, 7.45, 0.75);
    // fridge
    const fr = new THREE.Group(); fr.position.set(-4.3, 0, -8.5); this.group.add(fr);
    this.box(0.95, 2.0, 0.72, steel, 0, 1.0, 0, { parent: fr, round: 0.04 });
    const fdoorPivot = new THREE.Group(); fdoorPivot.position.set(-0.47, 0, 0.37); fr.add(fdoorPivot);
    const fdoor = this.box(0.93, 1.25, 0.05, steel, 0.47, 1.33, 0, { parent: fdoorPivot, round: 0.02 });
    this.box(0.93, 0.68, 0.05, steel, 0, 0.36, 0.37, { parent: fr, round: 0.02 });
    this.box(0.03, 0.5, 0.04, mat('handle', 0x9fa3a8, { m: 0.9, r: 0.2 }), 0.38, 1.2, 0.05, { parent: fdoorPivot });
    const inside = this.box(0.8, 1.1, 0.02, mat('fridgeIn', 0xfefcf8, { extra: { emissive: 0xfff8e8, emissiveIntensity: 0.35 } }), 0, 1.33, 0.32, { parent: fr, cast: false });
    this.fx.fridgeDoor = fdoorPivot; this.fx.fridge = fr;
    this.collider(-4.3, -8.5, 0.95, 0.78);
    // stove + oven
    const st = new THREE.Group(); st.position.set(-1.3, 0, -8.58); this.group.add(st);
    this.box(0.95, 0.86, 0.62, steel, 0, 0.43, 0, { parent: st, round: 0.02 });
    this.box(0.95, 0.03, 0.64, mat('cooktop', 0x1d1c1c, { r: 0.2 }), 0, 0.875, 0, { parent: st, round: 0.005 });
    this.box(0.7, 0.42, 0.02, mat('ovenGlass', 0x2a2422, { r: 0.1, extra: { emissive: 0x6b3a12, emissiveIntensity: 0.6 } }), 0, 0.42, 0.315, { parent: st, round: 0.01 });
    for (let i = 0; i < 4; i++) this.cyl(0.025, 0.025, 0.04, mat('knobB', 0x2b2b2b), -0.33 + i * 0.22, 0.76, 0.32, { parent: st }).rotation.x = Math.PI / 2;
    for (const [dx, dz] of [[-0.22, -0.13], [0.22, -0.13], [-0.22, 0.13], [0.22, 0.13]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), mat('burner', 0x444444)); ring.rotation.x = Math.PI / 2; ring.position.set(dx, 0.895, dz); st.add(ring);
    }
    const pot = new THREE.Group(); pot.position.set(-0.22, 0.9, 0.13); st.add(pot);
    this.cyl(0.14, 0.12, 0.17, steel, 0, 0.085, 0, { parent: pot }); this.cyl(0.145, 0.145, 0.02, steel, 0, 0.18, 0, { parent: pot });
    const kettle = new THREE.Group(); kettle.position.set(0.22, 0.9, -0.1); st.add(kettle);
    this.sphere(0.12, mat('kettle', 0xd9573f, { r: 0.35 }), 0, 0.11, 0, { parent: kettle, scale: [1, 0.85, 1] });
    const spout = this.cyl(0.015, 0.03, 0.14, mat('kettle', 0xd9573f), 0.13, 0.15, 0, { parent: kettle }); spout.rotation.z = -0.9;
    this.fx.kettle = kettle;
    // range hood
    this.box(1.0, 0.25, 0.55, steel, -1.3, 2.05, -8.65); this.box(0.4, 0.6, 0.3, steel, -1.3, 2.45, -8.78);
    // sink
    this.box(0.7, 0.04, 0.45, steel, 1.8, 0.9, -8.55, { round: 0.02 });
    this.box(0.6, 0.18, 0.38, mat('basin', 0x8d9196, { r: 0.25, m: 0.8 }), 1.8, 0.82, -8.55, { round: 0.03 });
    const fau = new THREE.Group(); fau.position.set(1.8, 0.9, -8.8); this.group.add(fau);
    this.cyl(0.02, 0.025, 0.36, steel, 0, 0.18, 0, { parent: fau });
    const neck = this.cyl(0.018, 0.018, 0.22, steel, 0, 0.36, 0.1, { parent: fau }); neck.rotation.x = Math.PI / 2;
    this.fx.faucet = fau;
    // upper cabinets + window over sink
    for (const [a, b] of [[-3.75, -1.85], [-0.75, 0.9], [2.75, 3.85]]) {
      const w = b - a, cx = (a + b) / 2; this.box(w, 0.75, 0.36, cab, cx, 1.95, -8.72);
      for (let x = a + 0.28; x < b - 0.1; x += 0.55) this.box(0.48, 0.65, 0.02, mat('cabFace', 0xbf7d48), x, 1.95, -8.53, { round: 0.01 });
    }
    this.window(1.8, -9.0, 1.4, 1.0, 1.75, 'north', false);
    this.box(7.5, 0.05, 0.1, mat('ledStrip', 0xfff3dc, { extra: { emissive: 0xffd9a0, emissiveIntensity: 1.2 } }), 0.13, 1.56, -8.6, { cast: false, round: 0 });
    // utensils, knife block, cutting board, coffee maker
    this.box(0.22, 0.3, 0.16, mat('knifeBlock', 0x7b4a28), -2.6, 1.06, -8.7);
    this.box(0.3, 0.4, 0.25, mat('coffee', 0x2b2b2b, { r: 0.4 }), 3.3, 1.1, -8.65);
    const cb = this.box(0.35, 0.5, 0.03, mat('cboard', 0xc49463), 0.4, 1.15, -8.82); cb.rotation.x = 0.12;
    this.box(1.6, 0.02, 0.02, steel, -0.4, 1.38, -8.88); // utensil rail
    for (let i = 0; i < 5; i++) this.box(0.04, 0.26, 0.02, mat('utensil', 0x6b4a32), -1.0 + i * 0.28, 1.24, -8.86);
    // island / prep counter
    const isl = new THREE.Group(); isl.position.set(-0.5, 0, -4.3); this.group.add(isl);
    this.box(2.6, 0.86, 0.95, cab, 0, 0.43, 0, { parent: isl });
    this.box(2.75, 0.06, 1.05, top, 0, 0.89, 0, { parent: isl, round: 0.015 });
    const jar = new THREE.Group(); jar.position.set(-0.7, 0.92, 0.1); isl.add(jar);
    this.cyl(0.12, 0.12, 0.28, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.1 }), 0, 0.14, 0, { parent: jar });
    this.cyl(0.11, 0.11, 0.2, mat('flour', 0xf7f3ea), 0, 0.1, 0, { parent: jar });
    this.cyl(0.13, 0.13, 0.04, mat('jarLid', 0xa0703f), 0, 0.3, 0, { parent: jar });
    this.fx.flourJar = jar;
    this.box(0.5, 0.03, 0.32, mat('cboard', 0xc49463), 0.2, 0.935, 0.05, { parent: isl, round: 0.01 });
    const bowl = this.sphere(0.2, mat('bowl', 0xe9e2d6, { r: 0.4 }), 0.85, 0.98, -0.05, { parent: isl, scale: [1, 0.45, 1] });
    for (let i = 0; i < 4; i++) this.sphere(0.07, mat('fruit' + i, [0xe0533a, 0xf2b631, 0x6fae3d, 0xe0533a][i]), 0.85 + Math.cos(i * 1.6) * 0.09, 1.06, -0.05 + Math.sin(i * 1.6) * 0.09, { parent: isl });
    this.collider(-0.5, -4.3, 2.75, 1.05);
    // stools
    for (const dx of [-0.8, 0.2]) {
      this.cyl(0.2, 0.2, 0.06, mat('stoolSeat', 0x6e4428), -0.5 + dx, 0.7, -3.45);
      this.cyl(0.025, 0.04, 0.68, mat('black', 0x2a2624), -0.5 + dx, 0.34, -3.45);
    }
    // pendant lights (reference)
    this.ceiling = [];
    for (const dx of [-1.4, -0.5, 0.4]) {
      const x = -0.5 + dx + 0.5;
      this.ceiling.push(this.cyl(0.006, 0.006, 0.9, mat('cord', 0x2b2b2b), x, 2.95, -4.3, { cast: false }));
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf1e6d2, side: THREE.DoubleSide, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.5 }));
      shade.position.set(x, 2.45, -4.3); this.group.add(shade); this.ceiling.push(shade);
      this.ceiling.push(this.sphere(0.06, mat('bulb', 0xfff2d0), x, 2.42, -4.3, { cast: false }));
    }
    this.pointLight(0xffc98a, 6, 7, -0.5, 2.3, -4.3);
    this.pointLight(0xffd29a, 3, 6, 1.5, 2.2, -7.5);
  }

  // ---------- ROOM 3: LIVING ROOM ----------
  sofa(x, z, len, rot, color = 0xdcc8ad) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.group.add(g);
    const fab = new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: fabricTex('#ffffff') });
    const legs = mat('sofaLeg', 0x5b3b25);
    this.box(len, 0.42, 0.95, fab, 0, 0.32, 0, { parent: g, round: 0.08 });
    this.box(len, 0.62, 0.25, fab, 0, 0.7, -0.38, { parent: g, round: 0.1 });
    for (const s of [-1, 1]) this.box(0.24, 0.62, 0.95, fab, s * (len / 2 - 0.08), 0.5, 0, { parent: g, round: 0.1 });
    const n = Math.max(2, Math.round(len / 0.95));
    const cw = (len - 0.4) / n;
    const cushions = [];
    for (let i = 0; i < n; i++) {
      cushions.push(this.box(cw - 0.04, 0.16, 0.7, fab, -len / 2 + 0.2 + cw * (i + 0.5), 0.6, 0.06, { parent: g, round: 0.07 }));
      const back = this.box(cw * 0.8, 0.42, 0.16, mat('pillow', 0xefe5d6, { r: 1 }), -len / 2 + 0.2 + cw * (i + 0.5), 0.88, -0.22, { parent: g, round: 0.07 });
      back.rotation.x = -0.25;
    }
    for (const s of [-1, 1]) for (const t of [-1, 1]) this.cyl(0.03, 0.025, 0.12, legs, s * (len / 2 - 0.12), 0.06, t * 0.38, { parent: g });
    return { g, cushions };
  }

  buildLiving() {
    const s1 = this.sofa(7.9, -4.3, 2.8, Math.PI / 2);   // faces east (towards TV)
    this.fx.sofa = s1;
    this.collider(7.9, -4.3, 1.0, 2.9);
    this.sofa(9.3, -8.35, 2.6, 0);                         // against the back wall facing south
    this.collider(9.3, -8.35, 2.7, 1.0);
    this.box(0.4, 0.42, 0.1, mat('pillowAcc', 0xc9a27e, { r: 1 }), 7.62, 0.85, -5.3, { round: 0.07 }).rotation.y = Math.PI / 2;
    // coffee table
    const ct = new THREE.Group(); ct.position.set(10.1, 0, -4.3); this.group.add(ct);
    const wood = mat('ctWood', 0x8a5a34, { r: 0.5 });
    this.box(0.9, 0.06, 1.5, wood, 0, 0.45, 0, { parent: ct });
    this.box(0.8, 0.03, 1.4, wood, 0, 0.15, 0, { parent: ct });
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.box(0.05, 0.45, 0.05, wood, a * 0.4, 0.225, b * 0.68, { parent: ct });
    this.books(-0.2, 0.48, -0.3, 3, true, ct);
    this.box(0.3, 0.02, 0.24, mat('magazine', 0xd75f4a), 0.15, 0.49, 0.35, { parent: ct, round: 0.005 });
    const vase = this.plant(0, 0, 0.3); ct.add(vase); vase.position.set(0.15, 0.48, -0.2);
    this.fx.coffeeTable = ct;
    this.collider(10.1, -4.3, 0.95, 1.55);
    // TV + stand (east wall)
    this.box(0.5, 0.5, 2.2, mat('tvStand', 0x7a4d2c, { r: 0.55 }), 12.6, 0.25, -4.3);
    const tv = new THREE.Group(); tv.position.set(12.62, 1.08, -4.3); this.group.add(tv);
    this.box(0.07, 0.95, 1.65, mat('tvBody', 0x1b1b1d, { r: 0.3 }), 0, 0, 0, { parent: tv, round: 0.02 });
    this.box(0.25, 0.04, 0.4, mat('tvBody', 0x1b1b1d), 0, -0.5, 0, { parent: tv });
    const tvScr = this.screenTexture(512, 288, (g, w, h) => drawTV(g, w, h, 0));
    const tvMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.86), new THREE.MeshBasicMaterial({ map: tvScr.tex, toneMapped: false }));
    tvMesh.rotation.y = -Math.PI / 2; tvMesh.position.x = -0.04; tv.add(tvMesh);
    this.fx.tv = { mesh: tvMesh, ...tvScr, redraw: (t = 0) => { drawTV(tvScr.canvas.getContext('2d'), 512, 288, t); tvScr.tex.needsUpdate = true; } };
    this.collider(12.6, -4.3, 0.6, 2.2);
    // big plant (dancing plant prank target)
    const bigPlant = this.plant(12.2, -8.25, 1.6, 0xcbb8a2);
    this.fx.plant = bigPlant;
    this.collider(12.2, -8.25, 0.7, 0.7);
    this.plant(4.7, -0.6, 1.0);
    this.collider(4.7, -0.6, 0.5, 0.5);
    // floor lamp
    this.cyl(0.18, 0.2, 0.04, mat('black', 0x2a2624), 5.0, 0.02, -8.3);
    this.cyl(0.02, 0.02, 1.6, mat('brass', 0xb8925a, { m: 0.7, r: 0.3 }), 5.0, 0.82, -8.3);
    this.cyl(0.24, 0.3, 0.38, new THREE.MeshStandardMaterial({ color: 0xf6ead6, emissive: 0xffd9a0, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 1 }), 5.0, 1.75, -8.3, { cast: false }).material.transparent = false;
    this.pointLight(0xffc98a, 4, 7, 5.1, 1.7, -7.9);
    this.pointLight(0xffd9a8, 3.5, 8, 10, 2.3, -4.3);
    // windows + rug + art
    this.window(7.4, -9.0, 1.6, 1.7, 1.5);
    this.window(11.0, -9.0, 1.6, 1.7, 1.5);
    this.plane(3.2, 3.6, new THREE.MeshStandardMaterial({ map: rugTex('#d8c8b3', '#bfa98e'), roughness: 1 }), 10.0, 0.01, -4.3, -Math.PI / 2);
    this.frame(5.4, 1.8, -8.88, 0.6, 0.85, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f3dcc0'); gr.addColorStop(1, '#c99a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,80,50,0.5)'; g.beginPath(); g.moveTo(0, h * 0.7); g.quadraticCurveTo(w * 0.5, h * 0.5, w, h * 0.75); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    });
  }

  // ---------- ROOM 5 (from reference): BEDROOM ----------
  buildBedroom() {
    const wood = mat('bedWood', 0x9a6239, { r: 0.55 });
    const linen = new THREE.MeshStandardMaterial({ color: 0xf1e7d8, roughness: 1, map: fabricTex('#ffffff') });
    const throwM = new THREE.MeshStandardMaterial({ color: 0xd9c2a6, roughness: 1, map: fabricTex('#ffffff') });
    const bed = new THREE.Group(); bed.position.set(-5.5, 0, 1.35); this.group.add(bed);
    this.box(2.1, 0.3, 2.4, wood, 0, 0.2, 0, { parent: bed });
    this.box(2.0, 0.25, 2.3, linen, 0, 0.47, 0, { parent: bed, round: 0.1 });
    this.box(2.2, 1.1, 0.14, mat('headboard', 0xcdb699, { r: 1 }), 0, 0.75, -1.2, { parent: bed, round: 0.06 });
    this.box(2.05, 0.1, 1.5, linen, 0, 0.62, 0.38, { parent: bed, round: 0.05 });
    this.box(2.1, 0.04, 0.6, throwM, 0, 0.68, 0.75, { parent: bed, round: 0.02 });
    const pillows = [];
    for (const s of [-0.5, 0.5]) pillows.push(this.box(0.85, 0.2, 0.45, linen, s, 0.7, -0.85, { parent: bed, round: 0.09 }));
    this.fx.bed = bed; this.fx.pillows = pillows;
    this.collider(-5.5, 1.35, 2.2, 2.5);
    // nightstands + lamps + alarm clock
    for (const x of [-7.0, -4.0]) {
      this.box(0.6, 0.55, 0.5, wood, x, 0.275, 0.45);
      this.box(0.5, 0.02, 0.02, mat('knob', 0xc8a26a), x, 0.38, 0.71);
      this.collider(x, 0.45, 0.6, 0.5);
    }
    this.cyl(0.1, 0.12, 0.25, mat('lampBase', 0xe7dccb), -7.0, 0.68, 0.4);
    this.cyl(0.15, 0.2, 0.22, new THREE.MeshStandardMaterial({ color: 0xf6ead6, emissive: 0xffd9a0, emissiveIntensity: 0.8, side: THREE.DoubleSide }), -7.0, 0.92, 0.4, { cast: false });
    this.pointLight(0xffc98a, 2.5, 5, -7.0, 1.2, 0.8);
    const clock = new THREE.Group(); clock.position.set(-4.0, 0.55, 0.45); this.group.add(clock);
    this.cyl(0.11, 0.11, 0.07, mat('clockRed', 0xd0563c, { r: 0.4 }), 0, 0.13, 0, { parent: clock }).rotation.x = Math.PI / 2;
    this.cyl(0.09, 0.09, 0.02, mat('clockFace', 0xfffaf0, { extra: { emissive: 0xfff3dc, emissiveIntensity: 0.3 } }), 0, 0.13, 0.036, { parent: clock }).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { this.sphere(0.04, mat('bell', 0xd9b45a, { m: 0.8, r: 0.3 }), s * 0.07, 0.25, 0, { parent: clock }); this.cyl(0.01, 0.01, 0.06, mat('black', 0x2a2624), s * 0.07, 0.03, 0, { parent: clock }); }
    this.fx.clock = clock;
    // wardrobe (west wall)
    const wd = new THREE.Group(); wd.position.set(-12.6, 0, 4.2); this.group.add(wd);
    this.box(0.75, 2.2, 2.0, wood, 0, 1.1, 0, { parent: wd });
    const doors = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.39, 0, s * 0.98); wd.add(piv);
      this.box(0.04, 2.05, 0.96, mat('wardDoor', 0xa86c40, { r: 0.5 }), 0, 1.1, -s * 0.48, { parent: piv });
      this.box(0.04, 0.3, 0.03, mat('knob', 0xc8a26a), 0.03, 1.1, -s * 0.88, { parent: piv });
      doors.push({ piv, s });
    }
    this.fx.wardrobe = { g: wd, doors };
    this.collider(-12.6, 4.2, 0.8, 2.05);
    // slippers on rug
    this.plane(3.2, 2.2, new THREE.MeshStandardMaterial({ map: rugTex('#e6dccd', '#cbb79c'), roughness: 1 }), -8.6, 0.01, 3.7, -Math.PI / 2);
    const sl = new THREE.Group(); sl.position.set(-9.0, 0, 3.6); this.group.add(sl);
    for (const s of [-1, 1]) this.box(0.13, 0.06, 0.3, mat('slipper', 0xe7a6a6, { r: 1 }), s * 0.1, 0.03, 0, { parent: sl, round: 0.03 });
    this.fx.slippers = sl;
    // dresser + art + window
    this.box(1.6, 0.85, 0.5, wood, -2.0, 0.425, 7.55);
    for (let i = 0; i < 3; i++) this.box(1.5, 0.22, 0.02, mat('wardDoor', 0xa86c40), -2.0, 0.2 + i * 0.27, 7.29, { round: 0.01 });
    this.collider(-2.0, 7.55, 1.6, 0.5);
    this.plant(-1.5, 0, 0.35).position.set(-1.5, 0.85, 7.55);
    this.frame(-12.88, 1.75, 1.3, 0.6, 0.8, (g, w, h) => { g.fillStyle = '#efe4d4'; g.fillRect(0, 0, w, h); g.fillStyle = '#d7b48f'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, 7); g.fill(); g.fillStyle = '#c49b7a'; g.beginPath(); g.arc(w / 2 + 30, h / 2 + 50, 40, 0, 7); g.fill(); }, Math.PI / 2);
    this.window(-12.86, 6.6, 1.6, 1.5, 1.55, 'west');
  }

  // ---------- ROOM 4: BATHROOM ----------
  buildBathroom() {
    const white = mat('porcelain', 0xfbf9f5, { r: 0.25 });
    const vanityWood = mat('vanity', 0x93603a, { r: 0.5 });
    const chrome = mat('chrome', 0xd0d3d7, { r: 0.2, m: 0.9 });
    // vanity + mirror (mirror on a tall panel above the cut wall)
    this.box(1.8, 0.82, 0.55, vanityWood, 2.6, 0.41, 0.4);
    this.box(1.85, 0.05, 0.6, mat('counterTop', 0xf1e8da), 2.6, 0.84, 0.4, { round: 0.01 });
    this.sphere(0.2, white, 2.6, 0.84, 0.42, { scale: [1.2, 0.35, 0.9] });
    this.cyl(0.015, 0.015, 0.2, chrome, 2.6, 0.95, 0.2);
    this.box(1.5, 1.25, 0.08, mat('mirrorFrame', 0x93603a), 2.6, 1.75, 0.12, { round: 0.02 });
    const mirScr = this.screenTexture(384, 320, (g, w, h) => drawMirror(g, w, h, 0));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.1), new THREE.MeshStandardMaterial({ map: mirScr.tex, roughness: 0.05, metalness: 0.3 }));
    mirror.position.set(2.6, 1.75, 0.165); this.group.add(mirror);
    this.fx.mirror = { mesh: mirror, ...mirScr, redraw: (t = 0) => { drawMirror(mirScr.canvas.getContext('2d'), 384, 320, t); mirScr.tex.needsUpdate = true; } };
    this.box(1.2, 0.08, 0.08, mat('lightBar', 0xfff8e8, { extra: { emissive: 0xfff0d0, emissiveIntensity: 2 } }), 2.6, 2.48, 0.2, { cast: false });
    this.pointLight(0xffe1b8, 4, 7, 2.6, 2.2, 1.2);
    this.collider(2.6, 0.4, 1.85, 0.6);
    // bathtub + curtain (east)
    const tub = new THREE.Group(); tub.position.set(8.1, 0, 2.4); this.group.add(tub);
    this.box(1.5, 0.6, 2.6, white, 0, 0.3, 0, { parent: tub, round: 0.12 });
    this.box(1.2, 0.1, 2.3, mat('tubIn', 0xe8eef2, { r: 0.15 }), 0, 0.56, 0, { parent: tub, round: 0.05 });
    this.cyl(0.02, 0.02, 2.6, chrome, -0.75, 2.0, 0, { parent: tub }).rotation.x = Math.PI / 2;
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4, 12, 1), new THREE.MeshStandardMaterial({ color: 0xf7f1e6, side: THREE.DoubleSide, roughness: 1 }));
    const cp = curtain.geometry.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 18) * 0.04); curtain.geometry.computeVertexNormals();
    curtain.position.set(-0.75, 1.3, -0.75); curtain.rotation.y = Math.PI / 2; tub.add(curtain);
    this.fx.tub = tub;
    this.collider(8.1, 2.4, 1.5, 2.6);
    // shower enclosure
    const sh = new THREE.Group(); sh.position.set(8.15, 0, 6.6); this.group.add(sh);
    this.box(1.4, 0.08, 1.6, mat('tray', 0xf0ece6, { r: 0.3 }), 0, 0.04, 0, { parent: sh, round: 0.02 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0xdff0f5, transparent: true, opacity: 0.25, roughness: 0.05 });
    this.box(0.03, 1.9, 1.6, glassM, -0.7, 1.0, 0, { parent: sh, cast: false, round: 0 });
    this.cyl(0.015, 0.015, 1.1, chrome, 0.62, 1.4, -0.2, { parent: sh });
    const head = this.cyl(0.12, 0.06, 0.05, chrome, 0.5, 1.95, -0.2, { parent: sh }); head.rotation.z = 0.6;
    this.fx.showerHead = new THREE.Vector3(8.65, 1.95, 6.4);
    // towel rack (south)
    const tr = new THREE.Group(); tr.position.set(4.4, 0, 7.82); this.group.add(tr);
    this.cyl(0.015, 0.015, 0.8, chrome, 0, 0.95, 0, { parent: tr }).rotation.z = Math.PI / 2;
    const towel = this.box(0.55, 0.65, 0.06, new THREE.MeshStandardMaterial({ color: 0xf2e9dc, roughness: 1, map: fabricTex('#ffffff') }), 0, 0.68, -0.02, { parent: tr, round: 0.03 });
    this.box(0.5, 0.06, 0.25, mat('towelStack', 0xe8dccb, { r: 1 }), 0.1, 1.17, -0.1, { parent: tr, round: 0.02 });
    this.fx.towel = towel;
    // toilet
    const wc = new THREE.Group(); wc.position.set(6.4, 0, 7.4); wc.rotation.y = Math.PI; this.group.add(wc);
    this.cyl(0.18, 0.15, 0.4, white, 0, 0.2, 0.05, { parent: wc });
    this.sphere(0.24, white, 0, 0.42, 0.05, { parent: wc, scale: [0.9, 0.25, 1.15] });
    this.box(0.45, 0.45, 0.2, white, 0, 0.62, -0.25, { parent: wc, round: 0.05 });
    this.collider(6.4, 7.4, 0.55, 0.75);
    this.plane(1.3, 0.8, new THREE.MeshStandardMaterial({ map: rugTex('#efe6d8', '#d8c8b0'), roughness: 1 }), 6.4, 0.012, 3.0, -Math.PI / 2);
    this.plant(1.0, 7.4, 0.8); this.collider(1.0, 7.4, 0.5, 0.5);
  }

  buildAnchors() {
    for (const [id, h] of Object.entries(HOTSPOTS)) {
      const a = new THREE.Object3D(); a.position.set(h.pos[0], 1.0, h.pos[1]); this.group.add(a); this.anchors[id] = a;
    }
  }

  // ---------- collision ----------
  collide(x, z, r) {
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.colliders) {
        const nx = Math.max(c.x0, Math.min(x, c.x1));
        const nz = Math.max(c.z0, Math.min(z, c.z1));
        const dx = x - nx, dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
          else {
            // centre inside box: push out along smallest axis
            const pen = [[x - c.x0 + r, -1, 0], [c.x1 - x + r, 1, 0], [z - c.z0 + r, 0, -1], [c.z1 - z + r, 0, 1]].sort((a, b) => a[0] - b[0])[0];
            x += pen[1] * pen[0]; z += pen[2] * pen[0];
          }
        }
      }
    }
    // missing corner (outside the house, east of the bathroom)
    if (x > 9 - r && z > 0 - r && x < 13.5 && z < 8.5) { if (x - 9 < z) x = Math.min(x, 9 - r); else z = Math.min(z, -r); }
    x = Math.max(-12.9 + r, Math.min(12.9 - r, x));
    z = Math.max(-8.9 + r, Math.min(7.9 - r, z));
    return [x, z];
  }
}

// ---------- screen drawings ----------
export function drawDesktop(g, w, h) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f4c890'); gr.addColorStop(1, '#d7835a');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(40, 40, 300, 200);
  g.fillStyle = '#5b8de0'; g.fillRect(40, 40, 300, 24);
  g.fillStyle = '#c9c1b5'; for (let i = 0; i < 6; i++) g.fillRect(60, 84 + i * 24, 160 + (i * 37) % 100, 10);
  g.fillStyle = 'rgba(30,24,20,0.7)'; g.fillRect(0, h - 26, w, 26);
  for (let i = 0; i < 6; i++) { g.fillStyle = ['#f4c35a', '#5b8de0', '#7bd389', '#f0755a', '#ddd', '#b48cf0'][i]; g.fillRect(150 + i * 36, h - 21, 22, 16); }
}
export function drawTV(g, w, h, t) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f4f6f'); gr.addColorStop(1, '#152535');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4c35a'; g.font = 'bold 34px sans-serif'; g.fillText('COOKING SHOW', 24, 54);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '20px sans-serif'; g.fillText('Episode 12 · Perfect Koshari', 24, 86);
  g.fillStyle = '#e9a15a'; g.beginPath(); g.arc(w * 0.72, h * 0.62, 70 + Math.sin(t * 2) * 3, 0, 7); g.fill();
  g.fillStyle = '#8a4a28'; g.beginPath(); g.arc(w * 0.72, h * 0.62, 50, 0, 7); g.fill();
}
export function drawMirror(g, w, h, fog) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#dfe7ea'); gr.addColorStop(0.5, '#b9c7cc'); gr.addColorStop(1, '#e8eef0');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(110, 0); g.lineTo(20, h); g.lineTo(-50, h); g.fill();
  if (fog > 0) { g.fillStyle = `rgba(250,250,250,${0.6 * fog})`; g.fillRect(0, 0, w, h); }
}
