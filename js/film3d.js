/* Dag Tours — 3D-дорога v5 (three.js, свой вендор).
   v5: пассажиры в окнах, фейерверк с люка, пастух из кустов, световая рамка-превращение.
   Рельеф с травяной текстурой, серпантин с разметкой, отбойник, знаки «День N»,
   фото-щиты, камни, деревья, облака, детализированный минивэн с отражениями и
   тенями, вечернее настроение, взлётная полоса и превращение в самолёт в финале.
   lite-режим для телефонов (без теней, меньше сетка). */
import * as THREE from '../vendor/three/three.module.min.js';

function hash(x, z) { var n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, z) {
  var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  var u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  var a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function fbm(x, z) { var s = 0, f = 0.025, a = 1; for (var o = 0; o < 4; o++) { s += (vnoise(x * f, z * f) - 0.5) * a; f *= 2.05; a *= 0.5; } return s; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export function create(stage, opts) {
  var lite = !!opts.lite;
  var canvas = stage.querySelector('.film__gl');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: lite ? 'low-power' : 'default' });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (opts.onLost) opts.onLost(); });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 2 : 1.25));   // телефон: чёткая картинка (слабые отсекает замер кадров)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  if (!lite) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }
  renderer.localClippingEnabled = true;   // срез минивэна/лайнера плоскостью рамки в финале

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdbeefb, lite ? 120 : 160, lite ? 430 : 720);
  var camera = new THREE.PerspectiveCamera(lite ? 70 : 56, 1, 0.5, 2000);
  var up = new THREE.Vector3(0, 1, 0);

  /* ---------- небо, солнце, облака ---------- */
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x5aa6e6) }, hor: { value: new THREE.Color(0xe4f0f8) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float h; void main(){ float t = smoothstep(-0.05, 0.5, h); gl_FragColor = vec4(mix(hor, top, t), 1.0); }'
  });
  var sky = new THREE.Mesh(new THREE.SphereGeometry(1000, lite ? 14 : 24, lite ? 7 : 10), skyMat);
  scene.add(sky);
  var hemi = new THREE.HemisphereLight(0xdcedff, 0x9a8f62, 0.8);
  scene.add(hemi);
  var sunDir = new THREE.Vector3(0.45, 0.8, -0.4).normalize();
  var sun = new THREE.DirectionalLight(0xfff0d2, 1.9);
  scene.add(sun); scene.add(sun.target);
  if (!lite) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    var sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 40; sc.far = 360;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  }
  function glowTexture(inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,225,1)', 'rgba(255,240,200,0)'), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.set(160, 160, 1); scene.add(sunSprite);
  var cloudTex = (function () {
    var c = document.createElement('canvas'); c.width = 256; c.height = 128; var g = c.getContext('2d');
    for (var i = 0; i < 14; i++) {
      var x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 26;
      var gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  var clouds = [];
  for (var ci = 0; ci < (lite ? 5 : 12); ci++) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    s.position.set(-350 + Math.random() * 700, 110 + Math.random() * 70, -150 - Math.random() * 900);
    var sw = 90 + Math.random() * 90; s.scale.set(sw, sw * 0.45, 1); scene.add(s); clouds.push(s);
  }

  /* ---------- окружение для отражений ---------- */
  (function () {
    var pm = new THREE.PMREMGenerator(renderer);
    var es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), skyMat.clone()));
    var gnd = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x8f9a5a, side: THREE.DoubleSide }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -3; es.add(gnd);
    scene.environment = pm.fromScene(es, 0.04).texture;
    pm.dispose();
  })();

  /* ---------- серпантин + взлётная полоса ---------- */
  var P = [
    [0, 0, 110], [0, 0, 65], [0, 0, 20], [2, 1, -50], [28, 5, -95], [60, 9, -120], [20, 13, -150], [-40, 18, -170],
    [-70, 23, -210], [-30, 28, -245], [30, 33, -270], [70, 38, -310], [40, 43, -350],
    [-20, 48, -385], [-60, 54, -430], [-20, 60, -475], [30, 65, -520], [50, 70, -590],
    [53, 70, -650], [55, 70, -740], [56, 70, -860], [57, 70, -1000]
  ].map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
  var curve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.6);
  var SAMPLES = 900;
  var samples = curve.getSpacedPoints(SAMPLES);
  var roadLen = curve.getLength();
  // где начинается полоса: ближайшая выборка к точке (53,70,-650)
  var runIdx = 0; (function () { var b = 1e18; for (var i = 0; i <= SAMPLES; i++) { var d = samples[i].distanceToSquared(P[16]); if (d < b) { b = d; runIdx = i; } } })();
  var uRun = runIdx / SAMPLES;
  // старт машины: ближайшая выборка к (0,0,20) — позади ещё ~90 м асфальта, чтобы дорога не начиналась из грунта
  var startIdx = 0; (function () { var b = 1e18; for (var i = 0; i <= SAMPLES; i++) { var d = samples[i].distanceToSquared(P[2]); if (d < b) { b = d; startIdx = i; } } })();
  var u0 = startIdx / SAMPLES;
  var S = [0.075, 0.17, 0.32, 0.47, 0.6, 0.72].map(function (s) { return u0 + s * (1 - u0); });   // доли пути: остановки по дням (дорога до полосы)

  function nearestRoad(x, z) {
    var best = 1e18, bi = 0;
    for (var i = 0; i <= SAMPLES; i += 2) {
      var p = samples[i], dx = p.x - x, dz = p.z - z, d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    var p0 = samples[bi], p1 = samples[Math.min(SAMPLES, bi + 2)];
    var tx = p1.x - p0.x, tz = p1.z - p0.z;
    var side = Math.sign(tx * (z - p0.z) - tz * (x - p0.x));
    var L2 = tx * tx + tz * tz, tt = L2 > 0 ? clamp(((x - p0.x) * tx + (z - p0.z) * tz) / L2, -1, 1) : 0;
    return { d: Math.sqrt(best), y: p0.y + (p1.y - p0.y) * tt, side: side, i: bi };
  }
  function ridge(x, z) {
    var s = 0, f = 0.0055, a = 1, w = 0;
    for (var o = 0; o < 5; o++) {
      var n = 1 - Math.abs(vnoise(x * f + o * 13.1, z * f + o * 7.7) * 2 - 1);
      s += n * n * a; w += a; f *= 2.0; a *= 0.5;
    }
    return s / w;
  }
  function terrainY(x, z) {
    var r = nearestRoad(x, z);
    var onRun = r.i >= runIdx - 6;
    var flat = onRun ? 22 : 5.5;
    var slope = r.side > 0 ? -0.5 : 0.6;
    var d = Math.max(0, r.d - flat);
    var blend = smooth(d / 16);
    var rise = Math.min(d, 42) * (0.35 + 0.65 * blend);
    if (onRun) rise *= 0.25;
    var far = smooth((d - 40) / 190);
    var hills = fbm(x, z) * 14;
    var mountains = (ridge(x, z) - 0.35) * (22 + 150 * far);
    return r.y - (lite ? 0.45 : 0.14) * (1 - blend) + slope * rise + (hills + mountains * (0.2 + 0.8 * far)) * blend;   // у полотна грунт чуть ниже асфальта
  }

  /* ---------- рельеф ---------- */
  var box = new THREE.Box3().setFromPoints(samples);
  var minX = box.min.x - (lite ? 250 : 380), maxX = box.max.x + (lite ? 250 : 380), minZ = box.min.z - (lite ? 260 : 380), maxZ = box.max.z + (lite ? 120 : 180);
  var cell = lite ? 6 : 4.8;
  var nx = Math.ceil((maxX - minX) / cell), nz = Math.ceil((maxZ - minZ) / cell);
  var tg = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz);
  tg.rotateX(-Math.PI / 2);
  tg.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  var pos = tg.attributes.position, colors = new Float32Array(pos.count * 3);
  var roadInfo = new Array(pos.count);
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), z = pos.getZ(i);
    roadInfo[i] = nearestRoad(x, z);
    pos.setY(i, terrainY(x, z));
  }
  tg.computeVertexNormals();
  var nrmA = tg.attributes.normal;
  var cGrass = new THREE.Color(0xaebb6a), cGrass2 = new THREE.Color(0x7a9348), cShoulder = new THREE.Color(0xbfb093);
  var cRock = new THREE.Color(0x8d8578), cRock2 = new THREE.Color(0x5f5a52), cSnow = new THREE.Color(0xf4f7f8), cValley = new THREE.Color(0x5e7a3c);
  var tmpC = new THREE.Color();
  for (var i2 = 0; i2 < pos.count; i2++) {
    var x2 = pos.getX(i2), z2 = pos.getZ(i2), y2 = pos.getY(i2), r2 = roadInfo[i2];
    var ny = nrmA.getY(i2), hrel = y2 - r2.y;
    var n = vnoise(x2 * 0.08, z2 * 0.08), n2 = vnoise(x2 * 0.02 + 50, z2 * 0.02);
    tmpC.copy(cGrass).lerp(cGrass2, n * 0.9);
    tmpC.lerp(cValley, clamp(-hrel / 60, 0, 0.5));                                   // низины темнее
    var rockT = clamp((0.82 - ny) / 0.22, 0, 1) * 0.9 + clamp((hrel - 55) / 60, 0, 1) * 0.6 * n2;
    tmpC.lerp(n > 0.5 ? cRock : cRock2, clamp(rockT, 0, 1));
    var snowT = clamp((hrel - 95 - n2 * 25) / 30, 0, 1) * clamp((ny - 0.55) / 0.3, 0, 1);
    tmpC.lerp(cSnow, snowT);
    var flat2 = r2.i >= runIdx - 6 ? 22 : 5.2;
    if (r2.d < flat2) tmpC.copy(cShoulder);
    else if (r2.d < flat2 + 2.5) tmpC.lerp(cShoulder, (flat2 + 2.5 - r2.d) / 2.5);
    colors[i2 * 3] = tmpC.r; colors[i2 * 3 + 1] = tmpC.g; colors[i2 * 3 + 2] = tmpC.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  var grassTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    for (var k = 0; k < 9000; k++) { var v = 205 + Math.floor(Math.random() * 50); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 220); return t;
  })();
  var terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  /* ---------- ленты: обочина, асфальт, полоса ---------- */
  function ribbon(width, lift, u0, u1, segs, uvScale, widthFn) {
    var verts = [], uvs = [], idx = [];
    for (var i = 0; i <= segs; i++) {
      var u = u0 + (u1 - u0) * (i / segs), p = curve.getPointAt(u), t = curve.getTangentAt(u);
      var w = widthFn ? widthFn(u) : width;
      var nrm = new THREE.Vector3().crossVectors(up, t).normalize();
      var l = p.clone().addScaledVector(nrm, -w / 2), rr = p.clone().addScaledVector(nrm, w / 2);
      verts.push(l.x, l.y + lift, l.z, rr.x, rr.y + lift, rr.z);
      uvs.push(0, (i / segs) * uvScale, 1, (i / segs) * uvScale);
      if (i < segs) { var k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  var roadTex = (function () {
    var c = document.createElement('canvas'); c.width = 128; c.height = 512; var g = c.getContext('2d');
    g.fillStyle = '#41464c'; g.fillRect(0, 0, 128, 512);
    for (var k = 0; k < 3000; k++) { g.fillStyle = 'rgba(' + (k % 2 ? '255,255,255' : '0,0,0') + ',0.07)'; g.fillRect(Math.random() * 128, Math.random() * 512, 2, 2); }
    g.fillStyle = '#e9e7df'; g.fillRect(5, 0, 3, 512); g.fillRect(120, 0, 3, 512);
    for (var m = 0; m < 512; m += 128) g.fillRect(62, m + 24, 4, 56);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = lite ? 2 : 8; return t;
  })();
  var runTex = (function () {
    var c = document.createElement('canvas'); c.width = 256; c.height = 2048; var g = c.getContext('2d');
    g.fillStyle = '#4b4f54'; g.fillRect(0, 0, 256, 2048);
    for (var k = 0; k < 9000; k++) { g.fillStyle = 'rgba(' + (k % 2 ? '255,255,255' : '0,0,0') + ',0.06)'; g.fillRect(Math.random() * 256, Math.random() * 2048, 2, 3); }
    g.fillStyle = '#f0efe8';
    for (var s2 = 0; s2 < 8; s2++) g.fillRect(16 + s2 * 30, 40, 14, 150);          // «зебра» порога
    for (var m = 260; m < 2048; m += 120) g.fillRect(121, m, 14, 70);               // осевая
    g.fillRect(4, 0, 6, 2048); g.fillRect(246, 0, 6, 2048);                         // кромки
    g.save(); g.translate(256, 0); g.scale(-1, 1); g.font = 'bold 110px Arial'; g.textAlign = 'center'; g.fillText('27', 128, 330); g.restore();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = lite ? 2 : 8; return t;
  })();
  var shoulder = new THREE.Mesh(ribbon(10.5, lite ? 0.1 : 0.03, 0, uRun, 600, roadLen * uRun / 14), new THREE.MeshLambertMaterial({ color: 0xbfb08d, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  shoulder.receiveShadow = true; scene.add(shoulder);
  var road = new THREE.Mesh(ribbon(7.2, lite ? 0.18 : 0.08, 0, uRun, 1000, roadLen * uRun / 14), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  road.receiveShadow = true; scene.add(road);
  var runway = new THREE.Mesh(ribbon(0, 0.09, uRun - 0.004, 1, 220, 1, function (u) { return 7.2 + 20 * smooth((u - uRun + 0.004) / 0.03); }), new THREE.MeshStandardMaterial({ map: runTex, roughness: 0.9 }));
  runway.receiveShadow = true; scene.add(runway);
  var apron = new THREE.Mesh(ribbon(40, 0.02, uRun + 0.02, 1, 60, 1), new THREE.MeshLambertMaterial({ color: 0xa9a48f }));
  scene.add(apron);
  // огни полосы
  (function () {
    var n = 70, m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 2 }), n * 2);
    var mt = new THREE.Matrix4(), k = 0;
    for (var i = 0; i < n; i++) {
      var u = uRun + 0.03 + (1 - uRun - 0.03) * (i / n), p = curve.getPointAt(u), t = curve.getTangentAt(u);
      var nrm = new THREE.Vector3().crossVectors(up, t).normalize();
      [-14.2, 14.2].forEach(function (o) { var q = p.clone().addScaledVector(nrm, o); mt.makeTranslation(q.x, q.y + 0.3, q.z); m.setMatrixAt(k++, mt); });
    }
    scene.add(m);
  })();

  /* ---------- отбойник справа (до полосы) ---------- */
  (function () {
    var verts = [], idx = [], segs = 600;
    for (var i = 0; i <= segs; i++) {
      var u = uRun * i / segs, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      var nrm = new THREE.Vector3().crossVectors(up, t).normalize();
      var e = p.clone().addScaledVector(nrm, 4.3);
      verts.push(e.x, e.y + 0.55, e.z, e.x, e.y + 0.85, e.z);
      if (i < segs) { var k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    var rail = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd2d6d9, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
    scene.add(rail);
    var postN = Math.floor(roadLen * uRun / 6);
    var posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.5 }), postN);
    var mtx = new THREE.Matrix4();
    for (var j = 0; j < postN; j++) {
      var uu = uRun * j / postN, pp = curve.getPointAt(uu), tt = curve.getTangentAt(uu);
      var nn = new THREE.Vector3().crossVectors(up, tt).normalize();
      var q = pp.clone().addScaledVector(nn, 4.3);
      mtx.makeTranslation(q.x, q.y + 0.45, q.z); posts.setMatrixAt(j, mtx);
    }
    scene.add(posts);
  })();

  /* ---------- растительность и камни ---------- */
  function scatter(count, minD, maxD, mesh, yOff, scaleRange, sideOnly, beforeRun) {
    var mtx = new THREE.Matrix4(), placed = 0, tries = 0;
    var pos3 = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    while (placed < count && tries < count * 60) {
      tries++;
      var x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ);
      var r = nearestRoad(x, z);
      if (r.d < minD || r.d > maxD) continue;
      if (sideOnly && r.side !== sideOnly) continue;
      if (beforeRun && r.i > runIdx - 10 && r.d < 60) continue;
      var s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      pos3.set(x, terrainY(x, z) + yOff * s, z);
      quat.setFromAxisAngle(up, Math.random() * 6.28);
      scl.set(s, s, s);
      mtx.compose(pos3, quat, scl); mesh.setMatrixAt(placed++, mtx);
    }
    mesh.count = placed; mesh.castShadow = !lite; mesh.receiveShadow = !lite;
    scene.add(mesh);
  }
  var treeGeo = (function () {
    var g1 = new THREE.ConeGeometry(1.9, 4.2, 7); g1.translate(0, 3.2, 0);
    var g2 = new THREE.ConeGeometry(1.4, 3.4, 7); g2.translate(0, 5.4, 0);
    var trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6); trunk.translate(0, 0.8, 0);
    // объединяем вручную (без утилит)
    var geos = [g1, g2, trunk], total = 0; geos.forEach(function (g) { total += g.attributes.position.count; });
    var posA = new Float32Array(total * 3), nrmA = new Float32Array(total * 3), colA = new Float32Array(total * 3), off = 0, idx = [];
    var cols = [new THREE.Color(0x2f6b3a), new THREE.Color(0x3b7d45), new THREE.Color(0x5a3f2a)];
    geos.forEach(function (g, gi) {
      var p = g.attributes.position, nn = g.attributes.normal, ind = g.index.array;
      for (var i = 0; i < p.count; i++) { posA.set([p.getX(i), p.getY(i), p.getZ(i)], (off + i) * 3); nrmA.set([nn.getX(i), nn.getY(i), nn.getZ(i)], (off + i) * 3); colA.set([cols[gi].r, cols[gi].g, cols[gi].b], (off + i) * 3); }
      for (var j = 0; j < ind.length; j++) idx.push(ind[j] + off);
      off += p.count;
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posA, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrmA, 3)); g.setAttribute('color', new THREE.BufferAttribute(colA, 3)); g.setIndex(idx);
    return g;
  })();
  scatter(lite ? 50 : 150, 10, 110, new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 170), 0, [0.7, 1.5], 0, true);
  scatter(lite ? 60 : 200, 6.5, 80, new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x5e7d3a, flatShading: true }), 240), 0.5, [0.5, 1.3], 0, true);
  scatter(lite ? 20 : 80, 7, 34, new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8e887c, flatShading: true }), 90), 0.3, [0.5, 2.0], -1, true);

  /* ---------- знаки «День N» и фото-щиты ---------- */
  var loader = new THREE.TextureLoader();
  function textTexture(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  var labels = opts.labels || [];
  var boards = [], signs = [];
  S.forEach(function (u, i) {
    // знак за 35 м до остановки
    var us = Math.max(0.005, u - 35 / roadLen), p = curve.getPointAt(us), t = curve.getTangentAt(us);
    var nrm = new THREE.Vector3().crossVectors(up, t).normalize();
    var g = new THREE.Group(); var base = p.clone().addScaledVector(nrm, lite ? 4.8 : 5.4); base.y = terrainY(base.x, base.z) + 0.1; g.position.copy(base);
    var lk = base.clone().addScaledVector(t, -20); lk.y = base.y; g.lookAt(lk);
    var tex = textTexture(512, 192, function (c) {
      c.fillStyle = '#1b5fae'; c.fillRect(0, 0, 512, 192); c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.strokeRect(10, 10, 492, 172);
      c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.font = 'bold 64px "Golos Text", Arial, sans-serif'; c.fillText('ДЕНЬ ' + i, 34, 86);
      c.font = '500 44px "Golos Text", Arial, sans-serif'; c.fillText((labels[i] || '').slice(0, 20), 34, 150);
      c.fillStyle = '#ffb03b'; c.beginPath(); c.moveTo(440, 60); c.lineTo(490, 96); c.lineTo(440, 132); c.closePath(); c.fill();
    });
    var sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 0.1), [null, null, null, null, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x8a8f94 })].map(function (m) { return m || new THREE.MeshStandardMaterial({ color: 0x8a8f94 }); }));
    sign.position.set(0, 3.2, 0); sign.castShadow = !lite; g.add(sign);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6 })); post.position.set(0, 1.3, 0); g.add(post);
    if (lite) g.scale.setScalar(1.35);
    scene.add(g); signs.push(g);
    // билборд: на стальной стойке в стороне от дороги, впереди остановки, повёрнут к водителю
    var ub = u + (lite ? 30 : 26) / roadLen, pb = curve.getPointAt(ub), tb = curve.getTangentAt(ub);
    var nb = new THREE.Vector3().crossVectors(up, tb).normalize();
    var gb = new THREE.Group(); var bb = pb.clone().addScaledVector(nb, lite ? -9 : -12.5); bb.y = terrainY(bb.x, bb.z);
    gb.position.copy(bb);
    var lb = bb.clone().addScaledVector(tb, -30).addScaledVector(nb, 9); lb.y = bb.y; gb.lookAt(lb);
    var steel = new THREE.MeshStandardMaterial({ color: 0x6b7278, metalness: 0.7, roughness: 0.45 });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 6.4, 12), steel); pole.position.set(0, 3.2, -0.3); pole.castShadow = !lite; gb.add(pole);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 5.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x2b3238, metalness: 0.4, roughness: 0.6 }));
    frame.position.set(0, 8.4, 0); frame.castShadow = !lite; gb.add(frame);
    var photo = new THREE.Mesh(new THREE.PlaneGeometry(9.1, 4.75), new THREE.MeshBasicMaterial({ color: 0x8a8f94 }));
    photo.position.set(0, 8.4, 0.13); gb.add(photo);
    if (opts.photos && opts.photos[i]) loader.load(opts.photos[i], function (tex2) { tex2.colorSpace = THREE.SRGBColorSpace; tex2.anisotropy = 8; photo.material = new THREE.MeshBasicMaterial({ map: tex2 }); dirty = true; kick(); });
    var brace = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.5), steel); brace.position.set(0, 6.1, -0.25); gb.add(brace);
    var walk = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.08, 0.7), steel); walk.position.set(0, 5.7, 0.3); gb.add(walk);
    var lampM = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xfff2c0, emissiveIntensity: 0.6 });
    [-2.6, 0, 2.6].forEach(function (x) { var l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), lampM); l.position.set(x, 6.3, 0.55); gb.add(l); });
    var tagTex = textTexture(512, 96, function (c) { c.fillStyle = '#ffb03b'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#0f1b24'; c.font = 'bold 54px "Unbounded", "Golos Text", Arial'; c.textAlign = 'center'; c.fillText('DAG TOURS', 256, 66); });
    var tag = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.52, 0.12), [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.6 }), steel]);
    tag.position.set(0, 11.3, 0); gb.add(tag);
    scene.add(gb); boards.push(gb);
  });

  /* ---------- Hyundai Grand Starex (по пропорциям) ---------- */
  var car = new THREE.Group(), mid = new THREE.Group(), inner = new THREE.Group();
  car.add(mid); mid.add(inner); inner.rotation.y = -Math.PI / 2;
  var van = new THREE.Group(); inner.add(van);
  var paint = new THREE.MeshStandardMaterial({ color: 0x121619, roughness: 0.26, metalness: 0.7 });
  var trim = new THREE.MeshStandardMaterial({ color: 0x1b1f23, roughness: 0.7, metalness: 0.1 });
  var glassM = new THREE.MeshStandardMaterial({ color: 0x0c1a21, roughness: 0.08, metalness: 0.85 });
  var cabinM = new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 1 });
  var chrome = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.2, metalness: 0.95 });
  function extrude(pts, depth, mat, bevel) {
    var sh = new THREE.Shape(); pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]); }); sh.closePath();
    var g = new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: true, bevelSize: bevel || 0.08, bevelThickness: bevel || 0.08, bevelOffset: -(bevel || 0.08), bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    var m = new THREE.Mesh(g, mat); m.castShadow = !lite; return m;
  }
  function bx(w, h, d, mat, x, y, z, shadow) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (shadow) m.castShadow = !lite; return m; }
  var body = extrude([[-2.45, 0.5], [-2.45, 1.3], [-2.32, 1.86], [0.85, 1.9], [1.35, 1.84], [2.0, 1.32], [2.42, 1.1], [2.5, 0.8], [2.42, 0.5]], 1.9, paint, 0.08);
  van.add(body);
  van.add(extrude([[-2.5, 0.42], [-2.5, 0.6], [2.54, 0.6], [2.54, 0.42]], 1.94, trim, 0.04));
  var ws = bx(0.05, 0.84, 1.62, glassM, 1.7, 1.6, 0); ws.rotation.z = -0.675; van.add(ws);              // лобовое
  [-1, 1].forEach(function (z) {
    van.add(bx(1.1, 0.46, 0.04, cabinM, 0.35, 1.52, z * 0.975)); van.add(bx(1.75, 0.46, 0.04, cabinM, -1.18, 1.52, z * 0.975)); // окна открыты — тёмный салон
    van.add(bx(3.25, 0.12, 0.05, glassM, -0.6, 1.33, z * 0.98));                                           // приспущенные стёкла
    [-2.1, -0.25, 0.95].forEach(function (x) { van.add(bx(0.09, 0.54, 0.05, paint, x, 1.52, z * 0.985)); });   // стойки
    van.add(bx(0.26, 0.18, 0.3, paint, 1.38, 1.36, z * 1.08, true));                                       // зеркала
    van.add(bx(0.22, 0.05, 0.03, chrome, -1.15, 1.15, z * 0.97)); van.add(bx(0.22, 0.05, 0.03, chrome, 0.45, 1.15, z * 0.97)); // ручки
    van.add(bx(2.7, 0.07, 0.08, chrome, -0.65, 1.95, z * 0.74));                                           // рейлинги
  });
  van.add(bx(0.06, 0.3, 1.1, trim, 2.49, 0.95, 0)); van.add(bx(0.07, 0.05, 1.12, chrome, 2.5, 1.1, 0));   // решётка
  var headM = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff1c0, emissiveIntensity: 1.0, roughness: 0.3 });
  var tailM = new THREE.MeshStandardMaterial({ color: 0x9a2018, emissive: 0xff3b2a, emissiveIntensity: 0.9, roughness: 0.35 });
  [-0.78, 0.78].forEach(function (z) { van.add(bx(0.08, 0.42, 0.34, headM, 2.53, 0.98, z)); van.add(bx(0.08, 0.72, 0.26, tailM, -2.49, 1.05, z * 1.06)); });
  van.add(bx(0.06, 0.07, 1.5, chrome, -2.5, 1.32, 0));                                                     // хром над номером
  van.add(bx(0.05, 0.42, 1.46, new THREE.MeshStandardMaterial({ color: 0x24404a, roughness: 0.06, metalness: 0.9 }), -2.49, 1.6, 0)); // заднее стекло с отражением
  van.add(bx(0.04, 0.22, 0.72, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), -2.52, 0.74, 0));
  // решётка с ламелями, антенна, арки
  [0.84, 0.95, 1.06].forEach(function (y) { van.add(bx(0.07, 0.03, 1.08, chrome, 2.51, y, 0)); });
  var ant = bx(0.03, 0.3, 0.03, trim, -1.2, 2.05, 0.5); ant.rotation.z = 0.5; van.add(ant);
  var archG = new THREE.TorusGeometry(0.5, 0.07, 6, 16, Math.PI); 
  [[-1.6, 0.98], [-1.6, -0.98], [1.55, 0.98], [1.55, -0.98]].forEach(function (w) { var a = new THREE.Mesh(archG, trim); a.position.set(w[0], 0.46, w[1] * 1.0); van.add(a); });
  // колёса: шина, диск со спицами, ступица
  var wheelG = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 20); wheelG.rotateX(Math.PI / 2);
  var rimG = new THREE.CylinderGeometry(0.27, 0.27, 0.33, 16); rimG.rotateX(Math.PI / 2);
  var spokeG = new THREE.BoxGeometry(0.46, 0.07, 0.04);
  var tireM = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9 });
  var rimM = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.45, metalness: 0.6 });
  var wheels = [], frontWheels = [];
  [[-1.6, 0.98, 0], [-1.6, -0.98, 0], [1.55, 0.98, 1], [1.55, -0.98, 1]].forEach(function (w) {
    var steer = new THREE.Group(); steer.position.set(w[0], 0.44, w[1]);
    var g = new THREE.Group(); steer.add(g);
    var tire = new THREE.Mesh(wheelG, tireM); tire.castShadow = !lite; g.add(tire);
    g.add(new THREE.Mesh(rimG, rimM));
    for (var sp = 0; sp < 5; sp++) { var s = new THREE.Mesh(spokeG, chrome); s.position.z = w[1] > 0 ? 0.17 : -0.17; s.rotation.z = sp * Math.PI * 2 / 5; g.add(s); }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 8), chrome); hub.rotation.x = Math.PI / 2; g.add(hub);
    van.add(steer); wheels.push(g); if (w[2]) frontWheels.push(steer);
  });
  var shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.05; shadowBlob.visible = lite; van.add(shadowBlob);

  /* ---------- люк и пассажиры (эксперимент): высунулись из открытых окон ---------- */
  van.add(bx(0.78, 0.04, 0.68, trim, -0.45, 1.93, 0));
  var lid = bx(0.7, 0.025, 0.6, glassM, 0, 0, 0); lid.geometry.translate(-0.35, 0, 0); lid.position.set(-0.1, 1.96, 0); lid.rotation.z = -0.75; van.add(lid);
  var skinM = new THREE.MeshStandardMaterial({ color: 0xe2b08c, roughness: 0.75 });
  var hairM = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.9 });
  var papakhaM = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1.0 });
  var gunM = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.4, metalness: 0.7 });
  var phoneM = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.3, metalness: 0.5 });
  var screenM = new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x9fdcff, emissiveIntensity: 0.9, roughness: 0.2 });
  var woolM = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 1.0 });
  var faceM = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 });
  var eyeM = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.4 });
  var recM = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 2 });
  function cloth(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); }
  function limb(len, r, mat) { var g = new THREE.Group(); var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 10), mat); m.position.y = -len / 2; m.castShadow = !lite; g.add(m); return g; }
  function makePerson(o) {
    // o: x — место вдоль кузова, side: +1 правый борт / -1 левый; человек сидит лицом по ходу (+x), наклонён наружу
    var coatM = cloth(o.coat);
    var p = new THREE.Group(); p.position.set(o.x, 1.28, o.side * 0.98); p.rotation.x = o.side * 0.5; van.add(p);
    p.add(bx(0.24, 0.44, 0.38, coatM, 0, 0.2, 0, true));                                                 // корпус
    p.add(bx(0.08, 0.08, 0.08, skinM, 0, 0.45, 0));                                                      // шея
    var head = new THREE.Group(); head.position.set(0, 0.6, 0); head.rotation.y = o.face === 'front' ? 0 : -o.side * Math.PI / 2; p.add(head);
    var face = new THREE.Group(); face.rotation.z = o.pitch || 0; head.add(face);                        // лицо смотрит вдоль +x группы face
    var hm = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), skinM); hm.castShadow = !lite; face.add(hm);
    [-0.045, 0.045].forEach(function (ez) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM); e.position.set(0.112, 0.02, ez); face.add(e); });
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skinM); nose.position.set(0.125, -0.015, 0); face.add(nose);
    if (o.beard) face.add(bx(0.07, 0.1, 0.15, hairM, 0.095, -0.075, 0));
    if (o.hat === 'papakha') { var pk = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.14, 0.17, 16), papakhaM); pk.position.y = 0.1; face.add(pk); var cr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8), papakhaM); cr.scale.y = 0.4; cr.position.y = 0.19; face.add(cr); }
    if (o.hat === 'hair') { var hr = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 12), hairM); hr.scale.set(0.95, 1.12, 1); hr.position.set(-0.04, 0.015, 0); face.add(hr); var tl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.32, 8), hairM); tl.position.set(-0.14, -0.12, 0); tl.rotation.z = 0.25; face.add(tl); }
    if (o.hat === 'bun') { var cap = new THREE.Mesh(new THREE.SphereGeometry(0.133, 16, 12), hairM); cap.scale.set(0.98, 0.9, 1); cap.position.set(-0.035, 0.03, 0); face.add(cap); var bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), hairM); bun.position.set(-0.1, 0.11, 0); face.add(bun); }
    if (o.hat === 'hood') { var hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), coatM); hd.scale.set(1, 0.95, 1); hd.position.set(-0.05, 0.02, 0); face.add(hd); }
    function arm(sz) {
      var sh = new THREE.Group(); sh.position.set(0, 0.4, sz * 0.2); p.add(sh);
      var upA = limb(0.28, 0.05, coatM); sh.add(upA);
      var el = new THREE.Group(); el.position.y = -0.28; upA.add(el);
      var fa = limb(0.26, 0.044, o.sleeves ? coatM : skinM); el.add(fa);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skinM); hand.position.y = -0.27; fa.add(hand);
      return { sh: sh, el: el, hand: hand };
    }
    var outer = arm(o.side), innerA = arm(-o.side);
    innerA.sh.rotation.x = -o.side * 0.9; innerA.el.rotation.x = -o.side * 0.5;                          // вторая рука лежит на двери
    return { g: p, head: head, face: face, arm: outer, hand: outer.hand };
  }
  // водитель: мужчина в папахе, стреляет в небо
  var shooter = makePerson({ x: 0.3, side: -1, coat: 0x23242a, hat: 'papakha', beard: true, pitch: 0.5, sleeves: true });
  shooter.arm.sh.rotation.x = 2.5;
  var gun = new THREE.Group(); shooter.hand.add(gun);
  gun.add(bx(0.034, 0.19, 0.034, gunM, 0, -0.1, 0)); gun.add(bx(0.03, 0.09, 0.05, gunM, 0.045, -0.02, 0)); gun.add(bx(0.05, 0.03, 0.04, gunM, 0.02, -0.17, 0));
  var muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,246,210,1)', 'rgba(255,140,40,0)'), transparent: true, depthWrite: false, opacity: 0, fog: false }));
  muzzle.position.set(0, -0.24, 0); muzzle.scale.set(0.001, 0.001, 1); gun.add(muzzle);
  // переднее пассажирское: девушка делает селфи
  var selfie = makePerson({ x: 0.3, side: 1, coat: 0xff6b57, hat: 'hair' });
  selfie.arm.sh.rotation.z = 2.0; selfie.arm.sh.rotation.x = -0.55;
  var phone1 = new THREE.Group(); selfie.hand.add(phone1);
  phone1.add(bx(0.075, 0.012, 0.15, phoneM, 0, -0.06, 0)); phone1.add(bx(0.068, 0.004, 0.142, screenM, 0, -0.052, 0));
  var selfieFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, opacity: 0, fog: false }));
  selfieFlash.position.set(0, -0.045, 0); selfieFlash.scale.set(0.001, 0.001, 1); phone1.add(selfieFlash);
  // правое заднее: парень держит барана за ноги
  var ramGuy = makePerson({ x: -1.15, side: 1, coat: 0x19b3c2, hat: 'hood', pitch: -0.5 });
  ramGuy.arm.sh.rotation.x = -Math.PI / 2;
  ramGuy.g.updateMatrix();
  var hp = new THREE.Vector3(0, 0.4, 0.74).applyMatrix4(ramGuy.g.matrix);
  var ram = new THREE.Group(); ram.position.copy(hp); van.add(ram);
  var ramLegs = [[0.1, 0.06], [0.1, -0.06], [-0.12, 0.06], [-0.12, -0.06]].map(function (l) { var lg = new THREE.Group(); lg.position.set(l[0], 0, l[1]); ram.add(lg); var m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 8), faceM); m.position.y = -0.15; lg.add(m); return lg; });
  var ramBody = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), woolM); ramBody.scale.set(1.35, 0.95, 1); ramBody.position.y = -0.46; ramBody.castShadow = !lite; ram.add(ramBody);
  var ramHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), faceM); ramHead.scale.set(1.3, 1, 0.9); ramHead.position.set(0.3, -0.64, 0); ram.add(ramHead);
  var hornM = new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 0.6 });
  [-1, 1].forEach(function (s) { var horn = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 14, Math.PI * 1.5), hornM); horn.position.set(0.27, -0.56, s * 0.1); horn.rotation.y = Math.PI / 2; ram.add(horn); ram.add(bx(0.03, 0.05, 0.1, faceM, 0.26, -0.6, s * 0.11)); });
  ram.add(bx(0.05, 0.12, 0.05, woolM, -0.3, -0.42, 0));
  // левое заднее: девушка снимает видео
  var video = makePerson({ x: -1.15, side: -1, coat: 0xffb03b, hat: 'bun', face: 'front' });
  video.arm.sh.rotation.z = 1.9; video.arm.sh.rotation.x = 0.5;
  var phone2 = new THREE.Group(); video.hand.add(phone2);
  phone2.add(bx(0.075, 0.012, 0.15, phoneM, 0, -0.03, 0)); phone2.add(bx(0.068, 0.004, 0.142, screenM, 0, -0.022, 0)); phone2.add(bx(0.02, 0.004, 0.02, eyeM, 0.02, -0.038, -0.05));
  var recDot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), recM); recDot.position.set(0.02, -0.019, 0.06); phone2.add(recDot);
  var nextShot = 0.6, shotT = -9, nextSelfie = 1.4, selfieT = -9, ramFA = 0;
  function updatePassengers(dt, t, dist, bank) {
    if (t > nextShot) { nextShot = t + 0.45 + Math.random() * 0.9; shotT = t; }
    var since = t - shotT, fl = Math.max(0, 1 - since / 0.08), rec = Math.exp(-since * 12);
    muzzle.material.opacity = fl; muzzle.scale.set(0.25 + 0.55 * fl, 0.25 + 0.55 * fl, 1);
    shooter.arm.sh.rotation.x = 2.5 + rec * 0.35; shooter.arm.el.rotation.x = rec * 0.25;
    shooter.head.rotation.x = Math.sin(t * 1.7) * 0.06;
    if (t > nextSelfie) { nextSelfie = t + 1.8 + Math.random() * 1.6; selfieT = t; }
    var sf = Math.max(0, 1 - (t - selfieT) / 0.14);
    selfieFlash.material.opacity = sf; selfieFlash.scale.set(0.2 + 0.8 * sf, 0.2 + 0.8 * sf, 1);
    selfie.head.rotation.z = Math.sin(t * 1.3) * 0.12; selfie.arm.sh.rotation.z = 2.0 + Math.sin(t * 0.9) * 0.08;
    ramFA += (clamp(-dist * 0.5, -0.35, 0.35) - ramFA) * 0.08;
    ram.rotation.x = bank * 2.5 + Math.sin(t * 2.4) * 0.14; ram.rotation.z = ramFA + Math.sin(t * 1.7 + 1) * 0.08;
    for (var i = 0; i < ramLegs.length; i++) ramLegs[i].rotation.z = Math.sin(t * 11 + i * 1.3) * 0.22;
    recDot.visible = (t % 1) < 0.6; video.arm.sh.rotation.y = Math.sin(t * 0.6) * 0.2; video.head.rotation.y = Math.sin(t * 0.6) * 0.2;
  }

  /* ---------- самолёт (появляется на полосе) ---------- */
  var plane = new THREE.Group(); inner.add(plane); plane.visible = false; plane.scale.setScalar(0.001);
  var white = new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.35, metalness: 0.15 });
  var teal = new THREE.MeshStandardMaterial({ color: 0x19b3c2, roughness: 0.4, metalness: 0.2 });
  var sunM = new THREE.MeshStandardMaterial({ color: 0xffb03b, roughness: 0.45, metalness: 0.1 });
  var fus = new THREE.CylinderGeometry(0.95, 0.95, 8.4, 24); fus.rotateZ(Math.PI / 2);
  var fm = new THREE.Mesh(fus, white); fm.position.set(0, 2.0, 0); fm.castShadow = !lite; plane.add(fm);
  var nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 14), white); nose.scale.set(1.9, 1, 1); nose.position.set(4.2, 2.0, 0); plane.add(nose);
  var tailC = new THREE.CylinderGeometry(0.35, 0.95, 3.4, 24); tailC.rotateZ(Math.PI / 2);
  var tm = new THREE.Mesh(tailC, white); tm.position.set(-5.9, 2.2, 0); tm.rotation.z = 0.06; plane.add(tm);
  plane.add(bx(8.6, 0.4, 1.95, teal, -0.4, 1.5, 0));                                                     // полоса по низу
  [-1, 1].forEach(function (z) { plane.add(bx(6.6, 0.24, 0.05, glassM, -0.5, 2.3, z * 0.95)); });         // иллюминаторы
  var cockpit = bx(1.0, 0.42, 1.5, glassM, 3.95, 2.3, 0); cockpit.rotation.z = 0.25; plane.add(cockpit);
  function flatShape(pts, depth, mat) {
    var sh = new THREE.Shape(); pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]); }); sh.closePath();
    var g = new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 });
    var m = new THREE.Mesh(g, mat); m.castShadow = !lite; return m;
  }
  [-1, 1].forEach(function (s) {
    var w = flatShape([[1.3, 0], [-1.7, 0], [-3.6, s * 6.2], [-2.9, s * 6.2]], 0.16, white);  // стреловидное крыло (x, z)
    w.rotation.x = Math.PI / 2; w.position.set(0, 1.45, 0); w.rotation.y = 0; w.rotation.z = 0; w.rotation.x = Math.PI / 2 - s * 0.07; plane.add(w);
    var tip = bx(0.7, 0.12, 0.9, teal, -3.3, 1.5 + 0.4, s * 6.2); tip.rotation.x = s * 0.9; plane.add(tip);   // винглет
    var eng = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.5, 2.6, 16), white); eng.rotation.z = Math.PI / 2; eng.position.set(0.1, 0.95, s * 2.6); eng.castShadow = !lite; plane.add(eng);
    var intake = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.25, 16), chrome); intake.rotation.z = Math.PI / 2; intake.position.set(1.42, 0.95, s * 2.6); plane.add(intake);
    var pyl = bx(1.2, 0.5, 0.18, white, -0.1, 1.35, s * 2.6); plane.add(pyl);
    var stab = flatShape([[-6.3, 0], [-7.6, 0], [-8.3, s * 2.6], [-7.7, s * 2.6]], 0.1, white); stab.rotation.x = Math.PI / 2; stab.position.set(0, 2.55, 0); plane.add(stab);
    var light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: s > 0 ? 0x2bff5a : 0xff3b3b, emissive: s > 0 ? 0x2bff5a : 0xff3b3b, emissiveIntensity: 2 })); light.position.set(-3.3, 1.5, s * 6.3); plane.add(light);
  });
  var finM = flatShape([[-5.3, 2.7], [-7.5, 2.7], [-8.3, 5.6], [-7.3, 5.6]], 0.14, teal); finM.position.set(0, 0, -0.07); plane.add(finM);   // киль (x, y)
  var finLogo = bx(0.9, 0.9, 0.2, sunM, -7.6, 4.6, 0); plane.add(finLogo);
  var gear = new THREE.Group(); plane.add(gear);
  [[3.2, 0], [-0.6, 1.1], [-0.6, -1.1]].forEach(function (p) {
    gear.add(bx(0.12, 1.0, 0.12, steelLike(), p[0], 0.55, p[1]));
    var wg = new THREE.CylinderGeometry(0.28, 0.28, 0.26, 12); wg.rotateX(Math.PI / 2);
    var wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9 })); wm.position.set(p[0], 0.28, p[1]); gear.add(wm);
  });
  function steelLike() { return new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.4 }); }
  scene.add(car);

  /* ---------- движение ---------- */
  var N = opts.stops || 6, F = [];
  for (var fi = 0; fi < N; fi++) F.push(0.03 + (0.8 * fi) / (N - 1));
  var FIN = F[N - 1] + 0.03;                 // начало финала на таймлайне

  /* ---------- световая рамка на полосе: минивэн проезжает сквозь неё и выходит лайнером (срез по плоскости) ---------- */
  var uGate = Math.min(0.97, Math.max(uRun, S[N - 1]) + 40 / roadLen);
  var gP = curve.getPointAt(uGate), gT = curve.getTangentAt(uGate).normalize(), gDot = gT.dot(gP);
  var gate = new THREE.Group(); gate.position.copy(gP); gate.position.y += 0.09; gate.lookAt(gP.clone().add(gT)); scene.add(gate);
  var gSteel = new THREE.MeshStandardMaterial({ color: 0x5f6870, metalness: 0.75, roughness: 0.4 });
  var gLight = new THREE.MeshStandardMaterial({ color: 0x19b3c2, emissive: 0x19b3c2, emissiveIntensity: 1.6, roughness: 0.5 });
  [-12.5, 12.5].forEach(function (x) {
    gate.add(bx(0.7, 9.8, 0.7, gSteel, x, 4.9, 0, true)); gate.add(bx(0.12, 8.6, 0.74, gLight, x - Math.sign(x) * 0.36, 4.6, 0)); gate.add(bx(1.4, 0.3, 1.4, gSteel, x, 0.15, 0));
  });
  var gateTex = textTexture(1024, 96, function (c) { c.fillStyle = '#0f1b24'; c.fillRect(0, 0, 1024, 96); c.fillStyle = '#ffb03b'; c.font = 'bold 50px "Unbounded", "Golos Text", Arial'; c.textAlign = 'center'; c.fillText('DAG TOURS  —  ДО НОВЫХ ВСТРЕЧ', 512, 65); });
  var beam = new THREE.Mesh(new THREE.BoxGeometry(25.7, 1.1, 0.9), [gSteel, gSteel, gSteel, gSteel, gSteel, new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.6 })]);
  beam.position.set(0, 10.1, 0); beam.castShadow = !lite; gate.add(beam);
  var curtainM = new THREE.MeshBasicMaterial({ color: 0x19b3c2, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
  var curtain = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 9.4), curtainM); curtain.position.set(0, 4.8, 0); gate.add(curtain);
  var pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(25,179,194,0)'), transparent: true, depthWrite: false, opacity: 0, fog: false }));
  pulse.position.set(0, 2.6, 0); pulse.scale.set(0.001, 0.001, 1); gate.add(pulse);
  var clipVan = new THREE.Plane(gT.clone().negate(), gDot), clipAir = new THREE.Plane(gT.clone(), -gDot);
  function setClip(root, pl) {
    root.traverse(function (m) {
      if (!m.material) return;
      var arr = Array.isArray(m.material);
      (arr ? m.material : [m.material]).forEach(function (mt, i) {
        if (mt.clippingPlanes && mt.clippingPlanes.length && mt.clippingPlanes[0] !== pl) { mt = mt.clone(); if (arr) m.material[i] = mt; else m.material = mt; }
        mt.clippingPlanes = [pl]; mt.clipShadows = true;
      });
    });
  }
  setClip(van, clipVan); setClip(plane, clipAir);
  plane.scale.setScalar(1.5); plane.visible = false;

  /* ---------- фейерверк с люка ---------- */
  var FW_MAX = lite ? 120 : 240, fwPos = new Float32Array(FW_MAX * 3), fwCol = new Float32Array(FW_MAX * 3), fwVel = new Float32Array(FW_MAX * 3), fwBase = new Float32Array(FW_MAX * 3);
  var fwLife = new Float32Array(FW_MAX), fwMax = new Float32Array(FW_MAX), fwKind = new Uint8Array(FW_MAX), fwCount = 0, fwNext = 0.8;
  var fwGeo = new THREE.BufferGeometry(); fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3)); fwGeo.setDrawRange(0, 0);
  var fwMat = new THREE.PointsMaterial({ size: lite ? 0.5 : 0.42, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  var fw = new THREE.Points(fwGeo, fwMat); fw.frustumCulled = false; fw.visible = false;   // фейерверк выключен (Амир 08.11), в сцену не добавляем
  var FW_COLORS = [[0.2, 0.95, 1], [1, 0.72, 0.25], [1, 1, 1], [1, 0.4, 0.65], [0.65, 1, 0.35]];
  var hatchPos = new THREE.Vector3(), carVel = new THREE.Vector3();
  function fwAdd(x, y, z, vx, vy, vz, life, c, kind) {
    if (fwCount >= FW_MAX) return; var i = fwCount++, k = i * 3;
    fwPos[k] = x; fwPos[k + 1] = y; fwPos[k + 2] = z; fwVel[k] = vx; fwVel[k + 1] = vy; fwVel[k + 2] = vz;
    fwBase[k] = c[0]; fwBase[k + 1] = c[1]; fwBase[k + 2] = c[2]; fwLife[i] = fwMax[i] = life; fwKind[i] = kind;
  }
  function fwRemove(i) {
    var j = --fwCount, k = i * 3, q = j * 3;
    for (var n = 0; n < 3; n++) { fwPos[k + n] = fwPos[q + n]; fwVel[k + n] = fwVel[q + n]; fwBase[k + n] = fwBase[q + n]; }
    fwLife[i] = fwLife[j]; fwMax[i] = fwMax[j]; fwKind[i] = fwKind[j];
  }
  function updateFireworks(dt, launching) {
    if (launching) {
      fwNext -= dt;
      if (fwNext <= 0) {
        fwNext = 0.8 + Math.random() * 0.9;
        hatchPos.set(-0.45, 2.0, 0); van.localToWorld(hatchPos);
        var c = FW_COLORS[(Math.random() * FW_COLORS.length) | 0];
        fwAdd(hatchPos.x, hatchPos.y, hatchPos.z, carVel.x * 0.6 - tmpT.x * 1.2 + (Math.random() - 0.5) * 1.5, 6.2 + Math.random() * 1.6, carVel.z * 0.6 - tmpT.z * 1.2 + (Math.random() - 0.5) * 1.5, 0.7 + Math.random() * 0.25, c, 1);
      }
    }
    if (!fwCount) { fw.visible = false; return false; }
    fw.visible = true;
    for (var i = fwCount - 1; i >= 0; i--) {
      fwLife[i] -= dt; var k = i * 3;
      if (fwLife[i] <= 0) {
        if (fwKind[i] === 1) {
          var n = lite ? 22 : 40, bx0 = fwPos[k], by0 = fwPos[k + 1], bz0 = fwPos[k + 2], c0 = [fwBase[k], fwBase[k + 1], fwBase[k + 2]];
          for (var s = 0; s < n; s++) {
            var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 2.6 + Math.random() * 2.6;
            fwAdd(bx0, by0, bz0, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, 0.8 + Math.random() * 0.6, Math.random() < 0.25 ? [1, 1, 1] : c0, 2);
          }
        }
        fwRemove(i); continue;
      }
      var g = fwKind[i] === 1 ? 2.5 : 6.5, dmp = fwKind[i] === 1 ? 1 : 1 - 1.2 * dt;
      fwVel[k] *= dmp; fwVel[k + 2] *= dmp; fwVel[k + 1] = fwVel[k + 1] * dmp - g * dt;
      fwPos[k] += fwVel[k] * dt; fwPos[k + 1] += fwVel[k + 1] * dt; fwPos[k + 2] += fwVel[k + 2] * dt;
      var f = fwLife[i] / fwMax[i], br = fwKind[i] === 1 ? 1.2 : f * f * 1.4;
      fwCol[k] = fwBase[k] * br; fwCol[k + 1] = fwBase[k + 1] * br; fwCol[k + 2] = fwBase[k + 2] * br;
    }
    fwGeo.setDrawRange(0, fwCount); fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true;
    return true;
  }

  /* ---------- пастух: изредка выбегает из кустов и бежит за машиной, машет палкой ---------- */
  var shep = new THREE.Group(); shep.visible = false; scene.add(shep);
  var shepLegs = [], shepArmR, shepArmL, shepT = -1, shepPhase = 0, sinceShep = 0, nextShep = 60 + Math.random() * 60, shepStart = new THREE.Vector3();
  (function () {
    var coat = cloth(0x3a2b22), pants = cloth(0x24201d);
    var burka = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.46, 1.05, 14), coat); burka.position.y = 1.12; burka.castShadow = !lite; shep.add(burka);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinM); head.position.y = 1.8; head.castShadow = !lite; shep.add(head);
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.15, 0.2, 14), papakhaM); hat.position.y = 1.94; shep.add(hat);
    var crown = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8), papakhaM); crown.scale.y = 0.35; crown.position.y = 2.04; shep.add(crown);
    shep.add(bx(0.16, 0.12, 0.08, hairM, 0, 1.7, 0.09));                                                 // борода (лицо смотрит в +z)
    [-0.045, 0.045].forEach(function (ex) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), eyeM); e.position.set(ex, 1.82, 0.115); shep.add(e); });
    [-1, 1].forEach(function (s) {
      var hip = new THREE.Group(); hip.position.set(s * 0.12, 0.85, 0); shep.add(hip);
      var lm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.85, 10), pants); lm.position.y = -0.42; lm.castShadow = !lite; hip.add(lm);
      hip.add(bx(0.1, 0.09, 0.24, hairM, 0, -0.86, 0.05)); shepLegs.push(hip);
    });
    function sArm(sx) { var sh = new THREE.Group(); sh.position.set(sx * 0.3, 1.55, 0); shep.add(sh); var upA = limb(0.3, 0.055, coat); sh.add(upA); var fa = limb(0.28, 0.048, skinM); fa.position.y = -0.3; upA.add(fa); var hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinM); hand.position.y = -0.29; fa.add(hand); return { sh: sh, hand: hand }; }
    shepArmR = sArm(-1); shepArmL = sArm(1);
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.2, 8), cloth(0x6b4a2b)); stick.position.y = -0.4; shepArmR.hand.add(stick);
  })();
  function updateShepherd(dt, dist, u) {
    if (shepT < 0) {
      if (dist > 0 && u > u0 + 0.02 && u < uRun - 0.03) { sinceShep += dist; }
      if (sinceShep > nextShep && u < uRun - 0.03) {
        var sdir = Math.random() < 0.5 ? -1 : 1;
        shepStart.copy(tmpP).addScaledVector(tmpT, -10).addScaledVector(tmpN, sdir * (8 + Math.random() * 3));
        shepStart.y = terrainY(shepStart.x, shepStart.z);
        shep.position.copy(shepStart); shep.visible = true; shepT = 0; shepPhase = 0;
      }
      return false;
    }
    shepT += dt;
    var chasing = shepT < 5.2;
    var goal = chasing ? car.position.clone().addScaledVector(tmpT, -5.5) : shepStart;
    var to = goal.clone().sub(shep.position); to.y = 0; var L = to.length(), run = L > 0.4 ? 1 : 0;
    if (run) shep.position.addScaledVector(to, Math.min(1, (chasing ? 5.6 : 3.2) * dt / L));
    shep.position.y = terrainY(shep.position.x, shep.position.z) + 0.02;
    shepPhase += dt * (run ? 9.5 : 2.5);
    shep.position.y += Math.abs(Math.sin(shepPhase)) * 0.06 * run;
    var face = goal.clone(); face.y = shep.position.y; if (L > 0.05) shep.lookAt(face);
    shepLegs[0].rotation.x = Math.sin(shepPhase) * 0.75 * run; shepLegs[1].rotation.x = -Math.sin(shepPhase) * 0.75 * run;
    shepArmR.sh.rotation.x = -2.5 + Math.sin(shepPhase * 1.1) * 0.35; shepArmR.sh.rotation.z = Math.sin(shepPhase * 1.1 + 1) * 0.45;
    shepArmL.sh.rotation.x = Math.sin(shepPhase) * 0.6 * run;
    if (shepT > 9) { shepT = -1; shep.visible = false; sinceShep = 0; nextShep = 110 + Math.random() * 110; }
    return true;
  }
  function toU(q) {
    if (q <= F[0]) return u0 + (S[0] - u0) * (q / F[0]);
    if (q >= F[N - 1]) { var tt = clamp((q - F[N - 1]) / (1 - F[N - 1]), 0, 1); return S[N - 1] + (0.985 - S[N - 1]) * tt * tt; }
    var i = 0; while (i < N - 2 && q >= F[i + 1]) i++;
    var t = (q - F[i]) / (F[i + 1] - F[i]);
    return S[i] + (S[i + 1] - S[i]) * smooth(t);   // плавный разгон и торможение к остановке/щиту
  }
  var target = 0, cur = 0, prevU = 0, bank = 0, dirty = true, running = false, braking = false, visible = true;
  var moodT = 0, moodGoal = 0;
  var dayTop = new THREE.Color(0x5aa6e6), dayHor = new THREE.Color(0xe4f0f8), daySun = new THREE.Color(0xfff1d8);
  var eveTop = new THREE.Color(0x3b5f9e), eveHor = new THREE.Color(0xf6c9a0), eveSun = new THREE.Color(0xffb070);
  function applyMood() {
    skyMat.uniforms.top.value.copy(dayTop).lerp(eveTop, moodT);
    skyMat.uniforms.hor.value.copy(dayHor).lerp(eveHor, moodT);
    scene.fog.color.copy(dayHor).lerp(eveHor, moodT);
    sun.color.copy(daySun).lerp(eveSun, moodT);
    sun.intensity = 1.9 - 0.6 * moodT;
    hemi.intensity = 0.75 - 0.25 * moodT;
    headM.emissiveIntensity = 1.0 + 1.8 * moodT;
  }
  var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camInit = false;
  var tmpT = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), prevT = new THREE.Vector3(0, 0, -1);

  var lastT = 0, steerA = 0, bob = 0, tAmb = 0, ambFrame = 0, inView = true, idle = 0, lastRender = 0, probe = [], probeDone = false, disposed = false;
  function frame(now) {
    running = false;
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    var k = 1 - Math.exp(-dt * 3.8);   // мягко догоняем прокрутку — глазу легче удержать фокус
    var moved = false;
    var d = target - cur;
    if (Math.abs(d) > 1e-5) { cur += d * k; moved = true; } else { cur = target; }
    if (Math.abs(moodGoal - moodT) > 0.004) { moodT += (moodGoal - moodT) * Math.min(1, dt * 4); applyMood(); moved = true; }
    var u = clamp(toU(cur), 0, 0.999);
    curve.getPointAt(u, tmpP); curve.getTangentAt(u, tmpT);
    tmpN.crossVectors(up, tmpT).normalize();
    // финал: выезд на полосу, проезд сквозь световую рамку (минивэн -> лайнер по срезу), разгон, взлёт
    var fq = clamp((cur - FIN) / (1 - FIN), 0, 1);
    var sGate = tmpP.dot(gT) - gDot;                              // где машина относительно рамки, м (+ = проехала)
    var morph = smooth((sGate + 10) / 14);                        // 0 — минивэн, 1 — самолёт
    var lift = Math.pow(clamp((fq - 0.5) / 0.5, 0, 1), 1.6);      // набор высоты
    van.visible = sGate < 3.5; plane.visible = sGate > -14;
    var crossing = clamp(1 - Math.abs(sGate + 4) / 10, 0, 1), cr = Math.sin(crossing * Math.PI);
    pulse.material.opacity = cr; pulse.scale.set(3 + 13 * cr, 3 + 13 * cr, 1);
    curtainM.opacity = 0.14 + 0.36 * cr;
    var retract = smooth((lift - 0.08) / 0.25);
    gear.scale.y = Math.max(0.001, 1 - retract); gear.position.y = 0.9 * retract;
    var laneOff = -1.6 * (1 - smooth(fq / 0.12));                 // на полосе выходим на ось
    car.position.copy(tmpP).addScaledVector(tmpN, laneOff);
    car.position.y += lift * 95;
    tmpL.copy(car.position).add(tmpT); tmpL.y += lift * 0.9;
    car.lookAt(tmpL);
    var du = u - prevU; prevU = u;
    var dist = du * roadLen;
    var turn = tmpT.x * prevT.z - tmpT.z * prevT.x; prevT.copy(tmpT);
    bank += (clamp(turn * 40, -0.08, 0.08) - bank) * 0.15;
    steerA += (clamp(turn * 28, -0.45, 0.45) - steerA) * 0.2;
    frontWheels.forEach(function (s) { s.rotation.y = steerA; });
    bob = Math.sin(cur * 900) * Math.min(0.012, Math.abs(dist) * 0.004) * (1 - morph);
    van.position.y = bob;
    mid.rotation.z = bank + Math.sin(cur * 70) * 0.05 * lift;
    mid.rotation.x = clamp(-dist * 0.02, -0.03, 0.03) * (1 - morph) - 0.22 * lift;
    wheels.forEach(function (w) { w.rotation.z -= dist / 0.43; });
    // ---- живые детали: пассажиры, фейерверк с люка, пастух из кустов ----
    var scrollMoved = moved;
    idle = scrollMoved ? 0 : idle + dt;
    var ambOn = visible && inView && cur > 0.004 && sGate < 2.5 && (!lite || scrollMoved) && idle < 8;   // в покое через 8 с всё замирает
    if (ambOn) tAmb += dt;
    updatePassengers(dt, tAmb, dist, bank);
    carVel.copy(tmpT).multiplyScalar(clamp(dt > 0 ? dist / dt : 0, -15, 15));
    if (updateShepherd(dt, dist, u) && inView) moved = true;
    if (ambOn) moved = true;
    tailM.emissiveIntensity = braking ? 2.6 : 0.9;
    // солнце и тень следуют за машиной
    sun.position.copy(car.position).addScaledVector(sunDir, 220); sun.target.position.copy(car.position);
    sunSprite.position.copy(camPos).addScaledVector(sunDir, 800);
    // камера
    var back = (lite ? 8.5 : 10.5) + 20 * morph + 24 * lift, upOff = (lite ? 3.4 : 3.3) + 6 * morph + 10 * lift;
    var desired = car.position.clone().addScaledVector(tmpT, -back).addScaledVector(tmpN, 0.5); desired.y += upOff;
    desired.y = Math.max(desired.y, terrainY(desired.x, desired.z) + 1.6);
    var look = car.position.clone().addScaledVector(tmpT, 9 + 20 * lift); look.y += 1.1 + 2.6 * morph + 2 * lift;
    // фокус камеры: у знака — взгляд на знак, на остановке — билборд в кадре целиком
    var focusFov = 0, fp = new THREE.Vector3();
    var vert = camera.aspect < 0.9, lead = vert ? 22 : 14, fw8 = 1;   // вертикальный экран: фокус на знаке раньше, пока он впереди — и машина, и знак в кадре
    for (var si = 0; si < S.length; si++) {
      var us = Math.max(0.005, S[si] - 35 / roadLen);
      // плато: полный фокус в пределах +-6 м у знака и +-9 м у щита, потом плавный спад
      var ds = Math.abs(u - (us - lead / roadLen)) * roadLen, db = Math.abs(u - S[si]) * roadLen;
      var fs = clamp(1 - Math.max(0, ds - 6) / 22, 0, 1), fb = clamp(1 - Math.max(0, db - 9) / 20, 0, 1);
      fs = fs * fs * (3 - 2 * fs); fb = fb * fb * (3 - 2 * fb);
      if (fs > 0 && signs[si]) { fp.copy(signs[si].position); fp.y += 3.0; look.lerp(fp, fs * (vert ? 1 : 0.75)); focusFov += 10 * fs; }
      if (fb > 0 && boards[si]) {
        boards[si].localToWorld(fp.set(0, 8.2, 0)); look.lerp(fp, fb * (vert ? 1 : 0.8)); focusFov += (lite ? 22 : 19) * fb;
        // камера подъезжает ближе и поднимается, чтобы щит занял кадр
        desired.y += 2.4 * fb; desired.addScaledVector(tmpN, 3.2 * fb); desired.addScaledVector(tmpT, 2.5 * fb);
      }
    }
    focusFov = Math.min(focusFov, lite ? 24 : 21);
    if (!camInit) { camPos.copy(desired); camLook.copy(look); camInit = true; }
    else { camPos.lerp(desired, 1 - Math.exp(-dt * 4.5)); camLook.lerp(look, 1 - Math.exp(-dt * 6)); }
    if (camPos.distanceToSquared(desired) > 0.0004 || camLook.distanceToSquared(look) > 0.0004) moved = true;
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.fov = (lite ? 70 : 56) + 8 * lift - focusFov; camera.updateProjectionMatrix();
    sky.position.copy(camPos);
    var gap = scrollMoved ? (lite ? 32 : 15) : 50;   // прокрутка: телефон ~30 к/с, ПК ~60; покой ~20 к/с
    if (dirty || now - lastRender >= gap) {
      renderer.render(scene, camera); lastRender = now;
      // замер: если при прокрутке кадры стабильно медленные — сообщаем наружу (откат в 2D / ниже качество)
      if (!probeDone && scrollMoved && dt > 0) { probe.push(dt * 1000); if (probe.length === 45) { probeDone = true; probe.sort(function (a, b) { return a - b; }); if (opts.onPerf) opts.onPerf(probe[33]); } }
    }
    dirty = false;
    if (moved && visible) kick();
  }
  function kick() { if (!running && !disposed) { running = true; requestAnimationFrame(frame); } }
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dirty = true; kick();
  }
  window.addEventListener('resize', resize);
  stage.__dbg = function () { return { tAmb: tAmb, fw: fwCount, inView: inView, visible: visible, cur: cur, shep: shepT, running: running }; };
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) kick(); }, { rootMargin: '120px' }).observe(stage);
  resize();
  applyMood();

  return {
    update: function (q, idx, near, brake, dark) { target = q; braking = !!brake; moodGoal = dark ? 1 : 0; visible = true; kick(); },
    setVisible: function (v) { visible = v; if (v) kick(); },
    // мгновенный прыжок в текущее положение без проигрывания дороги (сворачивание/разворачивание фильма)
    snap: function () { cur = target; prevU = clamp(toU(cur), 0, 0.999); camInit = false; dirty = true; kick(); },
    resize: resize,
    setQuality: function () { renderer.shadowMap.enabled = false; sun.castShadow = false; renderer.setPixelRatio(1); resize(); scene.traverse(function (m) { if (m.material) [].concat(m.material).forEach(function (mt) { mt.needsUpdate = true; }); }); },
    dispose: function () {
      disposed = true; window.removeEventListener('resize', resize);
      scene.traverse(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); });
      renderer.dispose(); renderer.forceContextLoss();
    },
    FIN: FIN
  };
}
