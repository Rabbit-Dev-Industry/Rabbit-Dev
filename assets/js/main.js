/**
 * RABBITDEV — main.js
 * ═══════════════════════════════════════════════════════════
 * Stack: Vanilla JS 100% · Three.js (CDN) opcionalmente cargado
 *
 * Módulos:
 *  1. Galaxy Canvas — Three.js con shader de partículas 3D
 *     └─ Reacciona al scroll (rotación, cámara, densidad)
 *     └─ Parallax multi-capa con mouse
 *  2. Preloader con contador animado
 *  3. Cursor personalizado con lerp
 *  4. Navbar scroll + mobile menu
 *  5. Hero text reveal (split por caracteres)
 *  6. Scroll reveals (IntersectionObserver)
 *  7. Magnetic buttons
 *  8. Contadores animados
 *  9. Dashboard canvas charts (line chart)
 * 10. Production chart (bar)
 * 11. KPI counters (ddkv)
 * 12. Form con validación
 * 13. Morphing scroll parallax en capas de la galaxia
 */

'use strict';

/* ── Utilidades ──────────────────────────────────────────── */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fract = v => v - Math.floor(v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const PRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const eOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const eOutQuart = t => 1 - Math.pow(1 - t, 4);

/* ════════════════════════════════════════════════════════════
   0. LENIS SMOOTH SCROLL — Experiencia cinematográfica
   ────────────────────────────────────────────────────────────
   Scroll suave, acelerado, con momentum natural.
   Compatible con ScrollTrigger y animaciones existentes.
════════════════════════════════════════════════════════════ */
let lenis = null;

function initLenis() {
  if (PRM || typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    duration: 1.2,        // Duración del smooth (1.2s = balance entre rápido y suave)
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out-expo custom
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    smoothTouch: false,   // Desactivado en touch para rendimiento
    touchMultiplier: 2,
    infinite: false,
  });

  // Integrar con requestAnimationFrame
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Eventos para debugging (opcional)
  lenis.on('scroll', ({ scroll, limit, velocity, direction, progress }) => {
    // Puedes escuchar el scroll para sincronizar otras animaciones
  });

  // Compatibilidad con anchors de navegación
  $$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      e.preventDefault();
      const target = $(targetId);
      if (target) {
        lenis.scrollTo(target, { offset: -80, duration: 1.5 });
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   1. GALAXY — Three.js con partículas 3D y shader custom
   ──────────────────────────────────────────────────────────
   Arquitectura:
   • BufferGeometry con 8000 partículas en espiral galáctica
   • ShaderMaterial con uniforms: uTime, uScroll, uMouse
   • uScroll controla: rotación, zoom de cámara, dispersión
   • Parallax con mousemove → rotación suave en X e Y
   • Dos brazos espirales con densidad variable
════════════════════════════════════════════════════════════ */
let galaxy = null;
let rabbitConstruction = null;

function initGalaxy() {
  const canvas = $('#galaxy');
  if (!canvas) return;

  canvas.dataset.scene = 'rabbit-supernova';

  if (typeof THREE === 'undefined') {
    initRabbitSupernova2D(canvas);
    return;
  }

  const TAU = Math.PI * 2;
  const CFG = {
    COUNT_CORONA: 1600,
    MOUSE_TILT: 0.16,
    SCROLL_ZOOM: 0.7,
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0.15, 7.2);

  const supernovaGroup = new THREE.Group();
  supernovaGroup.position.set(0, -0.02, 0);
  scene.add(supernovaGroup);

  function point(x, y) { return { x, y }; }

  function rotatePoint(x, y, rot) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function ellipse(cx, cy, rx, ry, count, rot = 0, start = 0, end = TAU) {
    const pts = [];
    const span = end - start;
    for (let i = 0; i <= count; i++) {
      const a = start + span * (i / count);
      const p = rotatePoint(Math.cos(a) * rx, Math.sin(a) * ry, rot);
      pts.push(point(cx + p.x, cy + p.y));
    }
    return pts;
  }

  function cubic(p0, p1, p2, p3, count) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const mt = 1 - t;
      pts.push(point(
        mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      ));
    }
    return pts;
  }

  function segment(x1, y1, x2, y2, count) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      pts.push(point(lerp(x1, x2, t), lerp(y1, y2, t)));
    }
    return pts;
  }

  const targets = [];
  const outlinePaths = [];

  function addTarget(x, y, z, mix = 0.5, heat = 0.5, source = 'fill') {
    targets.push({ x, y, z, mix, heat, source });
  }

  function addPath(path, z = 0.08, heat = 1) {
    outlinePaths.push({ pts: path, z });
    path.forEach((p, i) => addTarget(p.x, p.y, z + (Math.random() - 0.5) * 0.08, i / Math.max(1, path.length - 1), heat, 'outline'));
  }

  function addEllipseFill(cx, cy, rx, ry, count, rot = 0, z = -0.08, mixBase = 0.5, heatBase = 0.5) {
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random());
      const a = Math.random() * TAU;
      const p = rotatePoint(Math.cos(a) * rx * r, Math.sin(a) * ry * r, rot);
      const edge = smoothstep(0.66, 1, r);
      addTarget(
        cx + p.x,
        cy + p.y,
        z + (Math.random() - 0.5) * 0.22,
        clamp(mixBase + (Math.random() - 0.5) * 0.32, 0, 1),
        clamp(heatBase + edge * 0.45 + Math.random() * 0.15, 0, 1),
      );
    }
  }

  function buildRabbitSupernova() {
    addPath(ellipse(-0.62, 1.22, 0.25, 1.0, 142, -0.18), 0.18, 1);
    addPath(ellipse(0.62, 1.22, 0.25, 1.0, 142, 0.18), 0.18, 1);
    addPath(ellipse(0, -0.27, 1.1, 0.88, 220), 0.18, 1);
    addPath(ellipse(-0.35, -0.16, 0.07, 0.09, 44), 0.26, 0.96);
    addPath(ellipse(0.35, -0.16, 0.07, 0.09, 44), 0.26, 0.96);
    addPath([point(0, -0.36), point(-0.12, -0.45), point(0.12, -0.45), point(0, -0.36)], 0.3, 1);
    addPath(cubic(point(0, -0.49), point(-0.1, -0.62), point(-0.3, -0.66), point(-0.43, -0.55), 42), 0.23, 0.9);
    addPath(cubic(point(0, -0.49), point(0.1, -0.62), point(0.3, -0.66), point(0.43, -0.55), 42), 0.23, 0.9);

    [0.02, -0.14, -0.29].forEach(dy => {
      addPath(segment(-0.54, -0.36 + dy, -1.12, -0.24 + dy, 36), 0.12, 0.88);
      addPath(segment(0.54, -0.36 + dy, 1.12, -0.24 + dy, 36), 0.12, 0.88);
    });

    addEllipseFill(0, -0.27, 0.96, 0.72, 2350, 0, -0.08, 0.55, 0.54);
    addEllipseFill(-0.62, 1.22, 0.16, 0.82, 870, -0.18, -0.06, 0.22, 0.76);
    addEllipseFill(0.62, 1.22, 0.16, 0.82, 870, 0.18, -0.06, 0.82, 0.76);
    addEllipseFill(0, -1.0, 1.28, 0.34, 610, 0, -0.28, 0.5, 0.42);

    for (let i = 0; i < CFG.COUNT_CORONA; i++) {
      const a = Math.random() * TAU;
      const shell = Math.pow(Math.random(), 0.55);
      const rx = lerp(1.2, 2.65, shell);
      const ry = lerp(0.88, 1.75, shell);
      const yBias = -0.16 + Math.sin(a) * ry;
      addTarget(
        Math.cos(a) * rx,
        yBias,
        -0.5 - Math.random() * 0.5,
        Math.random(),
        0.25 + (1 - shell) * 0.45,
        'corona',
      );
    }
  }

  buildRabbitSupernova();

  const count = targets.length;
  const positions = new Float32Array(count * 3);
  const targetPositions = new Float32Array(count * 3);
  const novaPositions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const mixes = new Float32Array(count);
  const heats = new Float32Array(count);

  targets.forEach((p, i) => {
    const i3 = i * 3;
    const angle = Math.atan2(p.y + 0.08, p.x) + (Math.random() - 0.5) * 0.7;
    const radial = Math.hypot(p.x, p.y + 0.08);
    const blast = 2.1 + radial * 1.4 + Math.random() * 2.65;

    targetPositions[i3] = positions[i3] = p.x;
    targetPositions[i3 + 1] = positions[i3 + 1] = p.y;
    targetPositions[i3 + 2] = positions[i3 + 2] = p.z;

    novaPositions[i3] = Math.cos(angle) * blast;
    novaPositions[i3 + 1] = -0.08 + Math.sin(angle) * blast * 0.72;
    novaPositions[i3 + 2] = -1.25 - Math.random() * 1.7 + Math.sin(angle * 2) * 0.24;

    seeds[i3] = Math.random();
    seeds[i3 + 1] = radial;
    seeds[i3 + 2] = p.source === 'outline' ? 1 : p.source === 'corona' ? 0.35 : 0;
    sizes[i] = p.source === 'outline' ? 1.42 + Math.random() * 1.4 : p.source === 'corona' ? 0.55 + Math.random() * 0.9 : 0.78 + Math.random() * 1.08;
    mixes[i] = p.mix;
    heats[i] = p.heat;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetPositions, 3));
  geometry.setAttribute('aNova', new THREE.BufferAttribute(novaPositions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1));
  geometry.setAttribute('aHeat', new THREE.BufferAttribute(heats, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSize: { value: 38 * renderer.getPixelRatio() },
      uCore: { value: new THREE.Color('#fff7ad') },
      uViolet: { value: new THREE.Color('#a78bfa') },
      uSky: { value: new THREE.Color('#38bdf8') },
      uPink: { value: new THREE.Color('#f472b6') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform float uSize;

      attribute vec3 aTarget;
      attribute vec3 aNova;
      attribute vec3 aSeed;
      attribute float aSize;
      attribute float aMix;
      attribute float aHeat;

      varying float vAlpha;
      varying float vMix;
      varying float vHeat;
      varying float vFlash;
      varying float vOutline;

      void main() {
        float cycle = fract(uTime * 0.115 + aSeed.x * 0.055);
        float gather = smoothstep(0.16, 0.72, cycle);
        float dissolve = smoothstep(0.86, 1.0, cycle);
        float flash = (1.0 - smoothstep(0.0, 0.22, cycle)) * (0.7 + aHeat * 0.5);
        vec3 pos = mix(aNova, aTarget, gather);

        vec2 radial = normalize(aTarget.xy + vec2(0.0001, 0.08));
        pos.xy += radial * (sin(uTime * 2.2 + aSeed.x * 6.283) * 0.035 + flash * 0.22);
        pos.z += sin(uTime * 1.6 + aSeed.x * 12.0) * 0.06;
        pos = mix(pos, aNova * 0.72, dissolve * 0.35);
        pos.y -= uScroll * 0.9;
        pos.z += uScroll * 0.42;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        float pulse = 1.0 + flash * 1.45 + aSeed.z * 0.5;
        gl_PointSize = uSize * aSize * pulse * (1.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;

        vAlpha = (0.2 + gather * 0.78) * (1.0 - dissolve * 0.52) + flash * 0.3;
        vMix = aMix;
        vHeat = aHeat;
        vFlash = flash;
        vOutline = aSeed.z;
      }
    `,
    fragmentShader: `
      uniform vec3 uCore;
      uniform vec3 uViolet;
      uniform vec3 uSky;
      uniform vec3 uPink;

      varying float vAlpha;
      varying float vMix;
      varying float vHeat;
      varying float vFlash;
      varying float vOutline;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;

        float core = 1.0 - smoothstep(0.0, 0.25, dist);
        float halo = 1.0 - smoothstep(0.12, 0.5, dist);
        vec3 nebula = mix(uViolet, uSky, vMix);
        nebula = mix(nebula, uPink, clamp(vHeat * 0.55 + vOutline * 0.2, 0.0, 0.86));
        vec3 color = mix(nebula, uCore, clamp(core * 0.5 + vFlash * 0.7, 0.0, 0.9));
        float alpha = (core * 0.95 + halo * 0.42) * vAlpha;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, particleMaterial);
  particles.frustumCulled = false;
  supernovaGroup.add(particles);

  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending });
  const outlineLines = outlinePaths.map(path => {
    const geo = new THREE.BufferGeometry().setFromPoints(path.pts.map(p => new THREE.Vector3(p.x, p.y, path.z + 0.28)));
    const line = new THREE.Line(geo, outlineMaterial);
    line.frustumCulled = false;
    supernovaGroup.add(line);
    return line;
  });

  function makeEllipseLine(rx, ry, z, color, opacity) {
    const pts = ellipse(0, -0.12, rx, ry, 260).map(p => new THREE.Vector3(p.x, p.y, z));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    supernovaGroup.add(line);
    return line;
  }

  const shockRings = [
    makeEllipseLine(1.35, 1.02, -0.38, 0x38bdf8, 0.24),
    makeEllipseLine(1.95, 1.34, -0.55, 0xa78bfa, 0.2),
    makeEllipseLine(2.62, 1.82, -0.78, 0xf472b6, 0.16),
  ];

  const rayPositions = new Float32Array(92 * 2 * 3);
  for (let i = 0; i < 92; i++) {
    const a = (i / 92) * TAU + (Math.random() - 0.5) * 0.06;
    const inner = 0.78 + Math.random() * 0.3;
    const outer = 2.35 + Math.random() * 1.5;
    const idx = i * 6;
    rayPositions[idx] = Math.cos(a) * inner;
    rayPositions[idx + 1] = -0.12 + Math.sin(a) * inner * 0.7;
    rayPositions[idx + 2] = -0.5;
    rayPositions[idx + 3] = Math.cos(a) * outer;
    rayPositions[idx + 4] = -0.12 + Math.sin(a) * outer * 0.7;
    rayPositions[idx + 5] = -0.95;
  }
  const rayGeometry = new THREE.BufferGeometry();
  rayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
  const rayMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending });
  const rays = new THREE.LineSegments(rayGeometry, rayMaterial);
  rays.frustumCulled = false;
  supernovaGroup.add(rays);

  const coreGeo = new THREE.SphereGeometry(0.42, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.scale.set(1.8, 1.08, 0.24);
  core.position.set(0, -0.22, -0.4);
  supernovaGroup.add(core);

  let mouseX = 0;
  let mouseY = 0;
  let targetRotX = 0;
  let targetRotY = 0;
  let scrollProgress = 0;

  function resize() {
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    const scale = W < 560 ? 0.84 : W < 900 ? 0.98 : 1.12;
    supernovaGroup.scale.setScalar(scale);
    particleMaterial.uniforms.uSize.value = (W < 560 ? 31 : 38) * renderer.getPixelRatio();
  }

  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const hero = $('#hero');
    if (!hero) return;
    scrollProgress = clamp(window.scrollY / hero.offsetHeight, 0, 1);
  }, { passive: true });

  window.addEventListener('resize', resize, { passive: true });
  resize();

  const clock = new THREE.Clock();

  (function tick() {
    requestAnimationFrame(tick);

    if (document.body.classList.contains('light-mode')) return;

    const t = clock.getElapsedTime();
    particleMaterial.uniforms.uTime.value = PRM ? 6.5 : t;
    particleMaterial.uniforms.uScroll.value = scrollProgress;

    if (!PRM) {
      targetRotX = lerp(targetRotX, mouseY * 0.045 - scrollProgress * 0.08, 0.06);
      targetRotY = lerp(targetRotY, mouseX * CFG.MOUSE_TILT + Math.sin(t * 0.18) * 0.04, 0.06);
      supernovaGroup.rotation.x = targetRotX;
      supernovaGroup.rotation.y = targetRotY;
      supernovaGroup.rotation.z = Math.sin(t * 0.13) * 0.018;

      const pulse = 1 + Math.sin(t * 1.35) * 0.055;
      core.scale.set(1.8 * pulse, 1.08 * pulse, 0.24);
      coreMat.opacity = 0.12 + Math.max(0, Math.sin(t * 1.35)) * 0.1;
      outlineMaterial.opacity = 0.28 + Math.max(0, Math.sin(t * 1.5 + 0.6)) * 0.26;
      rayMaterial.opacity = 0.1 + Math.max(0, Math.sin(t * 0.85)) * 0.16;

      shockRings.forEach((ring, i) => {
        const phase = fract(t * 0.18 + i * 0.24);
        const ringScale = 0.78 + phase * 0.6;
        ring.scale.set(ringScale, ringScale, 1);
        ring.rotation.z = t * (0.03 + i * 0.012) * (i % 2 ? -1 : 1);
        ring.material.opacity = (0.28 - i * 0.045) * (1 - smoothstep(0.52, 1, phase));
      });

      outlineLines.forEach((line, i) => {
        line.position.z = Math.sin(t * 1.1 + i * 0.37) * 0.02;
      });
    }

    camera.position.z = lerp(camera.position.z, 7.2 - scrollProgress * CFG.SCROLL_ZOOM * 2.1, 0.045);
    camera.lookAt(0, -0.12, 0);
    renderer.render(scene, camera);
  })();

  galaxy = { scene: 'rabbit-supernova' };
}

function initRabbitSupernova2D(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let particles = [];
  let start = performance.now();
  let mx = 0;
  let my = 0;

  function pushParticle(x, y, scale) {
    const angle = Math.atan2(y + 0.08, x) + (Math.random() - 0.5) * 0.7;
    const blast = scale * (1.8 + Math.random() * 2.7);
    particles.push({
      tx: W / 2 + x * scale,
      ty: H / 2 + y * scale,
      sx: W / 2 + Math.cos(angle) * blast,
      sy: H / 2 + Math.sin(angle) * blast * 0.72,
      seed: Math.random(),
      r: 0.55 + Math.random() * 1.7,
      heat: Math.random(),
    });
  }

  function fillEllipse(cx, cy, rx, ry, count, scale, rot = 0) {
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const x = Math.cos(a) * rx * r;
      const y = Math.sin(a) * ry * r;
      pushParticle(cx + x * c - y * s, cy + x * s + y * c, scale);
    }
  }

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    if (!W || !H) return;

    const scale = Math.min(W, H) * (W < 560 ? 0.16 : 0.18);
    particles = [];
    fillEllipse(0, -0.27, 0.98, 0.72, 1550, scale);
    fillEllipse(-0.62, 1.22, 0.16, 0.82, 540, scale, -0.18);
    fillEllipse(0.62, 1.22, 0.16, 0.82, 540, scale, 0.18);
    fillEllipse(0, -1.0, 1.28, 0.34, 360, scale);

    for (let i = 0; i < 780; i++) {
      const a = Math.random() * Math.PI * 2;
      const shell = Math.pow(Math.random(), 0.55);
      pushParticle(Math.cos(a) * lerp(1.15, 2.55, shell), -0.12 + Math.sin(a) * lerp(0.8, 1.65, shell), scale);
    }
  }

  function draw(now) {
    if (document.body.classList.contains('light-mode')) {
      requestAnimationFrame(draw);
      return;
    }

    const t = (now - start) / 1000;
    const cycle = fract(t * 0.115);
    const gather = PRM ? 1 : smoothstep(0.14, 0.72, cycle);
    const dissolve = smoothstep(0.86, 1, cycle);
    const pulse = 1 + Math.sin(t * 1.35) * 0.06;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    ctx.save();
    ctx.translate(W / 2 + mx * 18, H / 2 + my * 10);
    ctx.scale(pulse, pulse);
    ['rgba(56,189,248,0.24)', 'rgba(167,139,250,0.18)', 'rgba(244,114,182,0.14)'].forEach((color, i) => {
      const phase = fract(t * 0.18 + i * 0.25);
      ctx.globalAlpha = 1 - smoothstep(0.52, 1, phase);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -12, W * (0.13 + phase * 0.08 + i * 0.035), H * (0.12 + phase * 0.07 + i * 0.025), i * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();

    particles.forEach(p => {
      const local = clamp(gather + p.seed * 0.05, 0, 1);
      let x = lerp(p.sx, p.tx + mx * 18, local);
      let y = lerp(p.sy, p.ty + my * 10, local);
      x = lerp(x, p.sx, dissolve * 0.28);
      y = lerp(y, p.sy, dissolve * 0.28);

      ctx.beginPath();
      ctx.arc(x, y, p.r * (1 + (1 - gather) * 0.8), 0, Math.PI * 2);
      ctx.globalAlpha = 0.22 + local * 0.55;
      ctx.fillStyle = p.heat > 0.72 ? '#fff7ad' : p.heat > 0.42 ? '#38bdf8' : '#a78bfa';
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(draw);

  galaxy = { scene: 'rabbit-supernova-2d', replay: () => { start = performance.now(); } };
}

function initRabbitConstruction() {
  const canvas = $('#rabbit-construction');
  if (!canvas) return;

  canvas.dataset.scene = 'rabbit-construction';

  if (typeof THREE === 'undefined') {
    initRabbitConstruction2D(canvas);
    return;
  }

  const TAU = Math.PI * 2;
  const clock = new THREE.Clock();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.12, 7.4);

  const rabbitGroup = new THREE.Group();
  rabbitGroup.position.set(0, -0.1, 0);
  scene.add(rabbitGroup);

  const palette = {
    dark: {
      a: '#a78bfa',
      b: '#38bdf8',
      c: '#34d399',
      outline: '#a5f3fc',
      blueprint: '#7c3aed',
      accent: '#f472b6',
      pointAlpha: 0.98,
      outlineAlpha: 0.44,
      blueprintAlpha: 0.22,
      blending: THREE.AdditiveBlending,
    },
    light: {
      a: '#1d4ed8',
      b: '#0284c7',
      c: '#6d28d9',
      outline: '#0f3b82',
      blueprint: '#0891b2',
      accent: '#7c3aed',
      pointAlpha: 0.78,
      outlineAlpha: 0.36,
      blueprintAlpha: 0.26,
      blending: THREE.NormalBlending,
    },
  };

  const targets = [];
  const outlinePaths = [];
  const technicalPaths = [];

  function point(x, y) { return { x, y }; }

  function rotatePoint(x, y, rot) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function ellipse(cx, cy, rx, ry, count, rot = 0, start = 0, end = TAU) {
    const pts = [];
    const span = end - start;
    for (let i = 0; i <= count; i++) {
      const a = start + span * (i / count);
      const p = rotatePoint(Math.cos(a) * rx, Math.sin(a) * ry, rot);
      pts.push(point(cx + p.x, cy + p.y));
    }
    return pts;
  }

  function cubic(p0, p1, p2, p3, count) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const mt = 1 - t;
      pts.push(point(
        mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      ));
    }
    return pts;
  }

  function segment(x1, y1, x2, y2, count) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      pts.push(point(lerp(x1, x2, t), lerp(y1, y2, t)));
    }
    return pts;
  }

  function addTarget(x, y, z, layer, mix, delayBias = 0) {
    const radial = Math.hypot(x * 0.72, y + 0.1) / 2.45;
    targets.push({
      x,
      y,
      z,
      layer,
      mix,
      delay: clamp(radial * 0.42 + Math.random() * 0.18 + delayBias, 0, 0.68),
    });
  }

  function addPath(path, opts = {}) {
    const layer = opts.layer ?? 1;
    const mix = opts.mix ?? 0.5;
    const z = opts.z ?? 0;
    const delayBias = opts.delayBias ?? 0;
    outlinePaths.push({ pts: path, z, delay: opts.lineDelay ?? 0 });
    path.forEach(p => addTarget(p.x, p.y, z + (Math.random() - 0.5) * 0.08, layer, mix, delayBias));
  }

  function addTechnicalPath(path, z = -0.34, delay = 0) {
    technicalPaths.push({ pts: path, z, delay });
  }

  function addEllipseFill(cx, cy, rx, ry, count, rot = 0, z = -0.06, layer = 0.28, mix = 0.5) {
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random());
      const a = Math.random() * TAU;
      const p = rotatePoint(Math.cos(a) * rx * r, Math.sin(a) * ry * r, rot);
      addTarget(cx + p.x, cy + p.y, z + (Math.random() - 0.5) * 0.22, layer, mix + (Math.random() - 0.5) * 0.3, 0.05);
    }
  }

  function buildRabbitBlueprint() {
    addPath(ellipse(-0.62, 1.24, 0.25, 1.02, 132, -0.17), { mix: 0.18, lineDelay: 0.02 });
    addPath(ellipse(0.62, 1.24, 0.25, 1.02, 132, 0.17), { mix: 0.82, lineDelay: 0.04 });
    addPath(ellipse(-0.58, 1.2, 0.09, 0.68, 80, -0.17), { layer: 0.65, mix: 0.05, z: 0.04, lineDelay: 0.1 });
    addPath(ellipse(0.58, 1.2, 0.09, 0.68, 80, 0.17), { layer: 0.65, mix: 0.95, z: 0.04, lineDelay: 0.12 });
    addPath(ellipse(0, -0.26, 1.1, 0.88, 188, 0), { mix: 0.5, lineDelay: 0.2 });

    addPath(ellipse(-0.36, -0.15, 0.075, 0.09, 48, 0), { layer: 1, mix: 0.1, z: 0.12, lineDelay: 0.34 });
    addPath(ellipse(0.36, -0.15, 0.075, 0.09, 48, 0), { layer: 1, mix: 0.9, z: 0.12, lineDelay: 0.36 });
    addPath([point(0, -0.36), point(-0.12, -0.45), point(0.12, -0.45), point(0, -0.36)], { layer: 1, mix: 0.55, z: 0.16, lineDelay: 0.42 });

    addPath(cubic(point(0, -0.48), point(-0.1, -0.62), point(-0.3, -0.66), point(-0.42, -0.55), 42), { layer: 0.85, mix: 0.24, z: 0.12, lineDelay: 0.48 });
    addPath(cubic(point(0, -0.48), point(0.1, -0.62), point(0.3, -0.66), point(0.42, -0.55), 42), { layer: 0.85, mix: 0.78, z: 0.12, lineDelay: 0.5 });

    [0.02, -0.14, -0.29].forEach((dy, i) => {
      addPath(segment(-0.55, -0.36 + dy, -1.08, -0.24 + dy, 34), { layer: 0.7, mix: 0.2, z: 0.08, lineDelay: 0.52 + i * 0.03 });
      addPath(segment(0.55, -0.36 + dy, 1.08, -0.24 + dy, 34), { layer: 0.7, mix: 0.82, z: 0.08, lineDelay: 0.52 + i * 0.03 });
    });

    const codeY = -1.08;
    addPath([...segment(-0.44, codeY, -0.72, codeY + 0.18, 24), ...segment(-0.72, codeY + 0.18, -0.44, codeY + 0.36, 24)], { layer: 1, mix: 0.12, z: 0.18, lineDelay: 0.62 });
    addPath([...segment(0.44, codeY, 0.72, codeY + 0.18, 24), ...segment(0.72, codeY + 0.18, 0.44, codeY + 0.36, 24)], { layer: 1, mix: 0.92, z: 0.18, lineDelay: 0.65 });

    addEllipseFill(0, -0.26, 0.94, 0.72, 920, 0, -0.1, 0.22, 0.55);
    addEllipseFill(-0.62, 1.24, 0.16, 0.82, 360, -0.17, -0.08, 0.22, 0.22);
    addEllipseFill(0.62, 1.24, 0.16, 0.82, 360, 0.17, -0.08, 0.22, 0.82);
    addEllipseFill(0, -1.0, 1.28, 0.36, 460, 0, -0.28, 0.08, 0.48);

    for (let i = 0; i < 360; i++) {
      const a = Math.random() * TAU;
      const r = 1.32 + Math.random() * 0.95;
      addTarget(Math.cos(a) * r, -0.16 + Math.sin(a) * r * 0.68, -0.46 - Math.random() * 0.26, 0.05, Math.random(), 0.14);
    }

    addTechnicalPath(ellipse(0, -0.1, 1.48, 1.12, 220), -0.42, 0.05);
    addTechnicalPath(ellipse(0, -0.08, 2.08, 1.4, 260, 0.09), -0.62, 0.12);
    addTechnicalPath(ellipse(0, -0.12, 2.55, 1.72, 300, -0.08), -0.8, 0.18);
    addTechnicalPath(segment(-2.25, -0.26, 2.25, -0.26, 80), -0.55, 0.26);
    addTechnicalPath(segment(0, -1.8, 0, 2.25, 92), -0.55, 0.3);
    addTechnicalPath(segment(-1.7, -1.44, 1.7, 1.88, 88), -0.7, 0.34);
    addTechnicalPath(segment(-1.7, 1.88, 1.7, -1.44, 88), -0.7, 0.36);
  }

  buildRabbitBlueprint();

  const count = targets.length;
  const positions = new Float32Array(count * 3);
  const targetPositions = new Float32Array(count * 3);
  const scatterPositions = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const sizes = new Float32Array(count);
  const layers = new Float32Array(count);
  const mixes = new Float32Array(count);

  targets.forEach((p, i) => {
    const i3 = i * 3;
    const burst = Math.random() * TAU;
    const radius = 2.1 + Math.random() * 3.4;
    const vertical = (Math.random() - 0.5) * 3.6;

    targetPositions[i3] = positions[i3] = p.x;
    targetPositions[i3 + 1] = positions[i3 + 1] = p.y;
    targetPositions[i3 + 2] = positions[i3 + 2] = p.z;

    scatterPositions[i3] = Math.cos(burst) * radius + p.x * 0.18;
    scatterPositions[i3 + 1] = vertical + p.y * 0.08;
    scatterPositions[i3 + 2] = -1.6 + Math.sin(burst) * radius * 0.55 + (Math.random() - 0.5) * 1.5;

    delays[i] = p.delay;
    layers[i] = p.layer;
    mixes[i] = clamp(p.mix, 0, 1);
    sizes[i] = p.layer > 0.7 ? 1.25 + Math.random() * 1.1 : 0.65 + Math.random() * 0.95;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetPositions, 3));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterPositions, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uScan: { value: 0 },
      uScroll: { value: 0 },
      uSize: { value: 34 * renderer.getPixelRatio() },
      uGlobalAlpha: { value: 1 },
      uTheme: { value: 0 },
      uColorA: { value: new THREE.Color(palette.dark.a) },
      uColorB: { value: new THREE.Color(palette.dark.b) },
      uColorC: { value: new THREE.Color(palette.dark.c) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uScan;
      uniform float uScroll;
      uniform float uSize;
      uniform float uGlobalAlpha;

      attribute vec3 aTarget;
      attribute vec3 aScatter;
      attribute float aDelay;
      attribute float aSize;
      attribute float aLayer;
      attribute float aMix;

      varying float vAlpha;
      varying float vMix;
      varying float vLayer;
      varying float vScan;

      void main() {
        float localBuild = smoothstep(aDelay, min(aDelay + 0.52, 1.0), uProgress);
        vec3 pos = mix(aScatter, aTarget, localBuild);

        float shimmer = sin(uTime * 2.4 + aTarget.x * 3.5 + aTarget.y * 2.0);
        pos.z += shimmer * 0.035 * localBuild;
        pos.xy += vec2(sin(uTime + aTarget.y * 2.0), cos(uTime * 0.8 + aTarget.x * 2.0)) * 0.018 * localBuild;
        pos.y -= uScroll * 0.95;
        pos.z += uScroll * 0.5;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = uSize * aSize * (1.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;

        float scanPos = fract(uScan);
        float yNorm = clamp((aTarget.y + 1.85) / 4.15, 0.0, 1.0);
        vScan = 1.0 - smoothstep(0.0, 0.075, abs(yNorm - scanPos));
        vAlpha = (0.06 + localBuild * 0.94) * uGlobalAlpha;
        vMix = aMix;
        vLayer = aLayer;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform float uTheme;

      varying float vAlpha;
      varying float vMix;
      varying float vLayer;
      varying float vScan;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;

        float core = 1.0 - smoothstep(0.0, 0.32, dist);
        float halo = 1.0 - smoothstep(0.14, 0.5, dist);
        vec3 base = mix(uColorA, uColorB, vMix);
        base = mix(base, uColorC, clamp(vLayer * 0.24 + vScan * 0.5, 0.0, 0.7));

        float inkBoost = mix(1.0, 1.18, uTheme);
        float alpha = (core * 0.86 + halo * 0.34 + vScan * 0.22) * vAlpha;
        gl_FragColor = vec4(base * inkBoost, alpha);
      }
    `,
    transparent: true,
    vertexColors: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, particleMaterial);
  particles.frustumCulled = false;
  rabbitGroup.add(particles);

  const outlineMaterial = new THREE.LineBasicMaterial({ color: palette.dark.outline, transparent: true, opacity: palette.dark.outlineAlpha, blending: THREE.AdditiveBlending });
  const technicalMaterial = new THREE.LineBasicMaterial({ color: palette.dark.blueprint, transparent: true, opacity: palette.dark.blueprintAlpha, blending: THREE.AdditiveBlending });
  const accentMaterial = new THREE.LineBasicMaterial({ color: palette.dark.accent, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending });

  const outlineLines = [];
  const technicalLines = [];

  function makeLine(path, z, material, delay = 0) {
    const pts = path.map(p => new THREE.Vector3(p.x, p.y, z));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    lineGeo.setDrawRange(0, 0);
    const line = new THREE.Line(lineGeo, material);
    line.frustumCulled = false;
    line.userData.count = pts.length;
    line.userData.delay = delay;
    return line;
  }

  outlinePaths.forEach((path, i) => {
    const line = makeLine(path.pts, path.z + 0.22, outlineMaterial, path.delay + i * 0.004);
    outlineLines.push(line);
    rabbitGroup.add(line);
  });

  technicalPaths.forEach((path, i) => {
    const material = i > 2 ? accentMaterial : technicalMaterial;
    const line = makeLine(path.pts, path.z, material, path.delay);
    technicalLines.push(line);
    rabbitGroup.add(line);
  });

  const nodeGeometry = new THREE.BufferGeometry();
  const nodePositions = new Float32Array(96 * 3);
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * TAU;
    const radius = i % 3 === 0 ? 2.18 : 1.62;
    nodePositions[i * 3] = Math.cos(angle) * radius;
    nodePositions[i * 3 + 1] = -0.08 + Math.sin(angle) * radius * 0.68;
    nodePositions[i * 3 + 2] = -0.72 + Math.sin(angle * 2.0) * 0.12;
  }
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  const nodeMaterial = new THREE.PointsMaterial({ size: 0.028, color: palette.dark.accent, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  rabbitGroup.add(nodes);

  let mouseX = 0;
  let mouseY = 0;
  let scrollProgress = 0;
  let replayAt = 0;
  let targetRotX = 0;
  let targetRotY = 0;

  function resize() {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const scale = width < 560 ? 0.82 : width < 900 ? 0.96 : 1.12;
    rabbitGroup.scale.setScalar(scale);
    particleMaterial.uniforms.uSize.value = (width < 560 ? 28 : 34) * renderer.getPixelRatio();
  }

  function isLightMode() {
    return document.body.classList.contains('light-mode');
  }

  function applyTheme(replay = true) {
    const current = isLightMode() ? palette.light : palette.dark;
    particleMaterial.uniforms.uColorA.value.set(current.a);
    particleMaterial.uniforms.uColorB.value.set(current.b);
    particleMaterial.uniforms.uColorC.value.set(current.c);
    particleMaterial.uniforms.uGlobalAlpha.value = current.pointAlpha;
    particleMaterial.uniforms.uTheme.value = isLightMode() ? 1 : 0;
    particleMaterial.blending = current.blending;
    particleMaterial.needsUpdate = true;

    outlineMaterial.color.set(current.outline);
    outlineMaterial.opacity = current.outlineAlpha;
    outlineMaterial.blending = current.blending;
    outlineMaterial.needsUpdate = true;

    technicalMaterial.color.set(current.blueprint);
    technicalMaterial.opacity = current.blueprintAlpha;
    technicalMaterial.blending = current.blending;
    technicalMaterial.needsUpdate = true;

    accentMaterial.color.set(current.accent);
    accentMaterial.opacity = isLightMode() ? 0.26 : 0.34;
    accentMaterial.blending = current.blending;
    accentMaterial.needsUpdate = true;

    nodeMaterial.color.set(current.accent);
    nodeMaterial.opacity = isLightMode() ? 0.42 : 0.6;
    nodeMaterial.blending = current.blending;
    nodeMaterial.needsUpdate = true;

    if (replay) replayAt = clock.getElapsedTime();
  }

  function buildProgress(t) {
    if (PRM) return 1;
    const elapsed = t - replayAt;
    if (elapsed < 4.2) return eOutExpo(clamp(elapsed / 2.8, 0, 1));

    const loop = ((elapsed - 4.2) % 8.4) / 8.4;
    if (loop < 0.6) return 1;
    if (loop < 0.82) return 1 - eOutQuart((loop - 0.6) / 0.22) * 0.18;
    return 0.82 + eOutExpo((loop - 0.82) / 0.18) * 0.18;
  }

  function updateDrawRanges(progress) {
    outlineLines.forEach(line => {
      const local = clamp((progress - line.userData.delay) / 0.48, 0, 1);
      line.geometry.setDrawRange(0, Math.max(2, Math.floor(line.userData.count * eOutExpo(local))));
    });

    technicalLines.forEach(line => {
      const local = clamp((progress - line.userData.delay) / 0.54, 0, 1);
      line.geometry.setDrawRange(0, Math.max(2, Math.floor(line.userData.count * eOutQuart(local))));
    });
  }

  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const hero = $('#hero');
    if (!hero) return;
    scrollProgress = clamp(window.scrollY / hero.offsetHeight, 0, 1);
  }, { passive: true });

  window.addEventListener('resize', resize, { passive: true });

  const themeObserver = new MutationObserver(() => applyTheme(true));
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  resize();
  applyTheme(false);

  (function tick() {
    requestAnimationFrame(tick);

    if (!document.body.classList.contains('light-mode')) return;

    const t = clock.getElapsedTime();
    const progress = buildProgress(t);
    particleMaterial.uniforms.uTime.value = t;
    particleMaterial.uniforms.uProgress.value = progress;
    particleMaterial.uniforms.uScan.value = (t * 0.12) % 1;
    particleMaterial.uniforms.uScroll.value = scrollProgress;

    updateDrawRanges(progress);

    if (!PRM) {
      targetRotX = lerp(targetRotX, mouseY * 0.055 - scrollProgress * 0.08, 0.055);
      targetRotY = lerp(targetRotY, mouseX * 0.12 + Math.sin(t * 0.22) * 0.03, 0.055);
      rabbitGroup.rotation.x = targetRotX;
      rabbitGroup.rotation.y = targetRotY;
      rabbitGroup.rotation.z = Math.sin(t * 0.16) * 0.018;
      nodes.rotation.z = t * 0.06;
      nodes.rotation.y = Math.sin(t * 0.2) * 0.16;
    }

    camera.position.z = lerp(camera.position.z, 7.4 - scrollProgress * 1.15, 0.04);
    camera.lookAt(0, -0.12, 0);
    renderer.render(scene, camera);
  })();

  rabbitConstruction = { scene: 'rabbit-construction', replay: () => { replayAt = clock.getElapsedTime(); } };
}

function initRabbitConstruction2D(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let particles = [];
  let start = performance.now();
  let mx = 0;
  let my = 0;

  function theme() {
    return document.body.classList.contains('light-mode')
      ? { a: '#1d4ed8', b: '#0284c7', grid: 'rgba(8,145,178,0.18)' }
      : { a: '#a78bfa', b: '#38bdf8', grid: 'rgba(167,139,250,0.12)' };
  }

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    const scale = Math.min(W, H) * 0.18;
    particles = [];

    function add(x, y) {
      particles.push({
        tx: W / 2 + x * scale,
        ty: H / 2 + y * scale,
        sx: W / 2 + (Math.random() - 0.5) * W * 0.9,
        sy: H / 2 + (Math.random() - 0.5) * H * 0.9,
        d: Math.random() * 0.5,
        r: 0.7 + Math.random() * 1.4,
      });
    }

    for (let i = 0; i < 1800; i++) {
      const shape = Math.random();
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random());
      if (shape < 0.55) add(Math.cos(a) * 1.05 * rr, -0.2 + Math.sin(a) * 0.86 * rr);
      else if (shape < 0.77) add(-0.62 + Math.cos(a) * 0.22 * rr, 1.18 + Math.sin(a) * 0.95 * rr);
      else add(0.62 + Math.cos(a) * 0.22 * rr, 1.18 + Math.sin(a) * 0.95 * rr);
    }
  }

  function draw(now) {
    const p = theme();
    const t = (now - start) / 1000;
    const progress = PRM ? 1 : eOutExpo(clamp(t / 2.6, 0, 1));
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = document.body.classList.contains('light-mode') ? 'source-over' : 'lighter';

    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(W / 2 + mx * 14, H / 2 + my * 8, W * (0.16 + i * 0.055), H * (0.18 + i * 0.04), i * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }

    particles.forEach(pt => {
      const local = smoothstep(pt.d, pt.d + 0.55, progress);
      const x = lerp(pt.sx, pt.tx + mx * 18, local);
      const y = lerp(pt.sy, pt.ty + my * 10, local);
      ctx.beginPath();
      ctx.arc(x, y, pt.r, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.5 ? p.a : p.b;
      ctx.globalAlpha = 0.18 + local * 0.58;
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const themeObserver = new MutationObserver(() => { start = performance.now(); });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(draw);
}

/* Fallback galaxy for the preloader canvas. */
function initGalaxy2D(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H;
  let particles = [];
  let scrollY2D = 0;
  let mx = 0, my = 0;

  const COUNT = 600;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    if (W < 1 || H < 1) return;
    particles = Array.from({ length: COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.pow(Math.random(), 0.6) * Math.min(W, H) * 0.42;
      const branch = Math.floor(Math.random() * 4);
      const ba    = branch / 4 * Math.PI * 2;
      const spin  = r / Math.min(W, H) * 0.42 * 2.5;
      return {
        x:    W / 2 + Math.cos(ba + spin) * r,
        y:    H / 2 + Math.sin(ba + spin) * r * 0.38,
        r:    Math.random() * 1.4 + 0.3,
        a:    Math.random() * 0.7 + 0.15,
        hue:  Math.random() > 0.5 ? 258 : 198,
        speed: (Math.random() - 0.5) * 0.12,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const tilt = scrollY2D * 0.0004;
    particles.forEach(p => {
      const dx = p.x - W / 2;
      const dy = p.y - H / 2;
      const cx =  Math.cos(tilt) * dx - Math.sin(tilt) * dy + W / 2;
      const cy =  Math.sin(tilt) * dx + Math.cos(tilt) * dy + H / 2;
      const wave = Math.sin(t * 0.6 + p.phase) * 0.6;
      const a    = p.a * (PRM ? 1 : 0.8 + wave * 0.2);
      ctx.beginPath();
      ctx.arc(cx + mx * 8, cy + my * 4 + wave, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},90%,72%,${a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth  - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('scroll', () => { scrollY2D = window.scrollY; }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(draw);
}

/* ════════════════════════════════════════════════════════════
   2. PRELOADER
════════════════════════════════════════════════════════════ */
function initPreloader(onDone) {
  const loader = $('#preloader');
  const bar    = $('#pl-bar');
  const pct    = $('#pl-pct');
  if (!loader) { onDone(); return; }

  // Mini galaxy de partículas en el preloader
  const pc = $('#preloader-canvas');
  if (pc) initGalaxy2D(pc);

  let v = 0;
  const target = { v: 0 };
  const step = () => {
    // Acelera progresivamente
    const speed = v < 70 ? 0.8 : v < 90 ? 0.35 : 0.15;
    v = Math.min(v + speed, 100);
    if (bar) bar.style.width = v + '%';
    if (pct) pct.textContent = Math.round(v) + '%';
    if (v < 100) { requestAnimationFrame(step); }
    else { finish(); }
  };
  requestAnimationFrame(step);

  function finish() {
    if (PRM) { loader.style.display = 'none'; onDone(); return; }
    loader.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)';
    loader.style.opacity    = '0';
    loader.style.transform  = 'translateY(-20px)';
    setTimeout(() => {
      loader.style.display = 'none';
      onDone();
    }, 650);
  }
}

/* ════════════════════════════════════════════════════════════
   3. CURSOR
════════════════════════════════════════════════════════════ */
function initCursor() {
  const dot   = $('#rd-cursor-dot');
  const trail = $('#rd-cursor-trail');
  if (!dot || !trail) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  let mx = 0, my = 0, tx = 0, ty = 0, raf;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    if (!raf) raf = requestAnimationFrame(movTrail);
  }, { passive: true });

  function movTrail() {
    tx = lerp(tx, mx, 0.1);
    ty = lerp(ty, my, 0.1);
    trail.style.transform = `translate(${tx}px,${ty}px) translate(-50%,-50%)`;
    raf = (Math.abs(tx - mx) > 0.5 || Math.abs(ty - my) > 0.5)
      ? requestAnimationFrame(movTrail)
      : null;
  }

  $$('a,button,.mag,[data-tilt]').forEach(el => {
    el.addEventListener('pointerenter', () => document.body.classList.add('c-hover'));
    el.addEventListener('pointerleave', () => document.body.classList.remove('c-hover'));
  });
  document.addEventListener('pointerdown', () => document.body.classList.add('c-click'));
  document.addEventListener('pointerup',   () => document.body.classList.remove('c-click'));
}

/* ════════════════════════════════════════════════════════════
   4. NAVBAR
════════════════════════════════════════════════════════════ */
function initNavbar() {
  const nav    = $('.navbar');
  const burger = $('#burger');
  const mobile = $('#nav-mobile');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
  if (window.scrollY > 60) nav.classList.add('scrolled');

  if (burger && mobile) {
    let open = false;
    burger.addEventListener('click', () => {
      open = !open;
      burger.setAttribute('aria-expanded', open);
      mobile.classList.toggle('open', open);
      mobile.setAttribute('aria-hidden', !open);
    });
    $$('a', mobile).forEach(a => a.addEventListener('click', () => {
      open = false;
      burger.setAttribute('aria-expanded', false);
      mobile.classList.remove('open');
      mobile.setAttribute('aria-hidden', true);
    }));
  }

  // Smooth scroll para anchors
  $$('.nav-link, .nav-mobile a, .scroll-indicator').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = $(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: PRM ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

/* ════════════════════════════════════════════════════════════
   5. HERO TEXT REVEAL — split chars con stagger
   Divide cada .ht-line en chars animados individualmente
════════════════════════════════════════════════════════════ */
function initHeroReveal() {
  if (PRM) {
    $$('.ht-line').forEach(l => l.innerHTML = l.dataset.text || l.textContent);
    return;
  }

  $$('.ht-line').forEach((line, li) => {
    const text = line.dataset.text || line.textContent.trim();
    line.innerHTML = '';

    // Wraps cada char en span con delay escalonado
    const inner = document.createElement('span');
    inner.className = 'ht-line-inner';
    inner.style.cssText = `display:block;transform:translateY(105%);will-change:transform`;
    inner.textContent = text;
    line.appendChild(inner);

    // Anima el bloque completo con delay por línea
    const delay = 0.3 + li * 0.18;
    setTimeout(() => {
      inner.style.transition = `transform 1s cubic-bezier(0.16,1,0.3,1) ${delay}s`;
      inner.style.transform  = 'translateY(0)';
    }, 50);
  });
}

/* ════════════════════════════════════════════════════════════
   6. SCROLL REVEALS — IntersectionObserver
════════════════════════════════════════════════════════════ */
function initReveals() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  $$('.reveal, .reveal-card').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) el.classList.add('in');
    else obs.observe(el);
  });
}

/* ════════════════════════════════════════════════════════════
   7. PARALLAX GALAXY LAYERS — mousemove + scroll
   Mueve las capas a velocidades diferentes para profundidad
════════════════════════════════════════════════════════════ */
function initParallaxLayers() {
  if (PRM) return;

  const layers = [
    { el: $('.galaxy-layer-1'), mx: 0.036, my: 0.024, sy: 0.12 },
    { el: $('.galaxy-layer-2'), mx: 0.066, my: 0.045, sy: 0.21 },
    { el: $('.galaxy-layer-3'), mx: 0.105, my: 0.075, sy: 0.36 },
  ].filter(l => l.el);

  let mx = 0, my = 0;
  let cmx = 0, cmy = 0;

  document.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let raf;
  (function tick() {
    raf = requestAnimationFrame(tick);
    cmx = lerp(cmx, mx, 0.06);
    cmy = lerp(cmy, my, 0.06);

    const sy = window.scrollY;
    layers.forEach(({ el, mx: mxf, my: myf, sy: syf }) => {
      el.style.transform = `translate(${cmx * mxf * 60}px, ${cmy * myf * 60 + sy * syf}px)`;
    });
  })();
}

/* ════════════════════════════════════════════════════════════
   8. MAGNETIC BUTTONS
   Atracción física con lerp — solo en pointer:fine
════════════════════════════════════════════════════════════ */
function initMagnetic() {
  if (PRM) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  $$('.mag').forEach(el => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf;
    const STRENGTH = 0.36;
    const EASE     = 0.12;

    function tick() {
      cx = lerp(cx, tx, EASE);
      cy = lerp(cy, ty, EASE);
      el.style.transform = `translate(${cx}px,${cy}px)`;
      raf = (Math.abs(cx-tx)>.05 || Math.abs(cy-ty)>.05)
        ? requestAnimationFrame(tick) : null;
    }

    el.addEventListener('pointermove', e => {
      const r  = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      tx = dx * STRENGTH; ty = dy * STRENGTH;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    el.addEventListener('pointerleave', () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });

    // Ripple
    el.addEventListener('pointerdown', e => {
      const r    = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const rip  = document.createElement('span');
      rip.className   = 'rd-ripple';
      rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
      el.appendChild(rip);
      setTimeout(() => rip.remove(), 520);
    });
  });
}

/* ════════════════════════════════════════════════════════════
   9. CONTADORES ANIMADOS — data-count y .ast-val
════════════════════════════════════════════════════════════ */
function initCounters() {
  const allCounters = [
    ...$$(('[data-count]')),
    ...$$(('.ast-val[data-count]')),
    ...$$(('.metric-val[data-count]')),
  ];

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      const el  = e.target;
      const end = parseInt(el.dataset.count, 10);
      if (PRM) { el.textContent = end; return; }

      const dur = 600;
      const t0  = performance.now();
      (function up(now) {
        const t  = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(eOutQuart(t) * end);
        if (t < 1) requestAnimationFrame(up);
      })(performance.now());
    });
  }, { threshold: 0.5 });

  allCounters.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) {
      el.textContent = el.dataset.count;
    } else {
      obs.observe(el);
    }
  });
}

/* ════════════════════════════════════════════════════════════
   10. DASHBOARD KPI COUNTERS
════════════════════════════════════════════════════════════ */
function initDashboardKPIs() {
  const kpis = [
    { id: '#ddkv1', to: 142,  dur: 600 },
    { id: '#ddkv2', to: 98.4, dur: 600, dec: 1 },
    { id: '#ddkv3', to: 12,   dur: 600 },
  ];

  const section = $('#data');
  if (!section) return;

  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    obs.unobserve(section);

    kpis.forEach(({ id, to, dur = 600, dec = 0 }, i) => {
      const el = $(id);
      if (!el) return;
      if (PRM) { el.textContent = to.toFixed(dec); return; }

      const t0 = performance.now() + i * 50;
      (function up(now) {
        if (now < t0) { requestAnimationFrame(up); return; }
        const t  = Math.min((now - t0) / dur, 1);
        el.textContent = (eOutQuart(t) * to).toFixed(dec);
        if (t < 1) requestAnimationFrame(up);
      })(performance.now());
    });

    drawDataChart();
  }, { threshold: 0.25 });

  obs.observe(section);
}

/* ════════════════════════════════════════════════════════════
   11. DATA LINE CHART — canvas animado
════════════════════════════════════════════════════════════ */
function drawDataChart() {
  const cv = $('#data-chart');
  if (!cv) return;

  const ctx = cv.getContext('2d');
  const W = cv.offsetWidth || 400;
  const H = cv.offsetHeight || 160;
  cv.width = W; cv.height = H;

  const pad = { t: 16, r: 16, b: 28, l: 36 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;
  const MAX = 160;

  // Datos simulados — eventos/seg por hora
  const labels = ['00','02','04','06','08','10','12','14','16','18','20','22'];
  const data1  = [28, 35, 42, 38, 55, 88, 142, 131, 119, 95, 72, 44];
  const data2  = [20, 25, 30, 28, 40, 65, 102,  95,  88, 70, 55, 32];

  function render(prog) {
    ctx.clearRect(0, 0, W, H);

    // Grid
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const y = pad.t + cH * (1 - f);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.font = '9px monospace'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(MAX * f), pad.l - 4, y + 3);
    });

    // Labels X
    labels.forEach((l, i) => {
      const x = pad.l + (i / (labels.length - 1)) * cW;
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(l + 'h', x, H - 6);
    });

    function drawSeries(data, color, fillColor) {
      const n = Math.max(2, Math.ceil(data.length * prog));
      const pts = data.map((v, i) => ({
        x: pad.l + (i / (data.length - 1)) * cW,
        y: pad.t + cH * (1 - v / MAX),
      }));

      // Fill
      const gr = ctx.createLinearGradient(0, pad.t, 0, H);
      gr.addColorStop(0, fillColor);
      gr.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.moveTo(pts[0].x, H - pad.b);
      pts.slice(0, n).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[n-1].x, H - pad.b);
      ctx.closePath();
      ctx.fillStyle = gr; ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) {
        const cpx = (pts[i-1].x + pts[i].x) / 2;
        ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Dots
      pts.slice(0, n).forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
    }

    drawSeries(data2, 'rgba(124,58,237,0.7)',  'rgba(124,58,237,0.08)');
    drawSeries(data1, 'rgba(56,189,248,0.9)',   'rgba(56,189,248,0.1)');
  }

  if (PRM) { render(1); return; }
  const t0 = performance.now();
  (function f(now) {
    const t = Math.min((now - t0) / 1100, 1);
    render(eOutExpo(t));
    if (t < 1) requestAnimationFrame(f);
  })(performance.now());
}

/* ════════════════════════════════════════════════════════════
   12. PRODUCTION BAR CHART
════════════════════════════════════════════════════════════ */
function initProdChart() {
  const section = $('#production');
  if (!section) return;

  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    obs.unobserve(section);
    drawProdChart();
  }, { threshold: 0.25 });

  obs.observe(section);
}

function drawProdChart() {
  const cv = $('#prod-chart');
  if (!cv) return;

  const ctx = cv.getContext('2d');
  const W = cv.offsetWidth || 360;
  const H = cv.offsetHeight || 100;
  cv.width = W; cv.height = H;

  const pad = { t: 10, r: 16, b: 24, l: 36 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  const hours = ['06','07','08','09','10','11','12'];
  // OEE promedio por hora
  const oee = [72, 81, 88, 91, 94, 89, 85];
  const MAX = 100;

  const gap = cW / hours.length;
  const bW  = gap * 0.58;

  function roundRect(ctx, x, y, w, h, r) {
    if (h < 1) return;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  hours.forEach((h, i) => {
    const bx  = pad.l + i * gap + (gap - bW) / 2;
    const tgt = (oee[i] / MAX) * cH;
    const color = oee[i] >= 85 ? '#38bdf8' : oee[i] >= 70 ? '#fbbf24' : '#f87171';

    if (PRM) { paint(bx, bW, tgt, h, oee[i], color); return; }

    const t0 = performance.now() + i * 55;
    (function f(now) {
      if (now < t0) { requestAnimationFrame(f); return; }
      const t  = Math.min((now - t0) / 800, 1);
      const ht = tgt * eOutExpo(t);
      ctx.clearRect(bx - 1, pad.t, bW + 2, cH + 4);
      paint(bx, bW, ht, h, oee[i] * eOutExpo(t), color);
      if (t < 1) requestAnimationFrame(f);
    })(performance.now());
  });

  function paint(x, w, h, label, val, color) {
    const y = pad.t + cH - h;
    // Glow
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, color); gr.addColorStop(1, color + '44');
    roundRect(ctx, x, y, w, h, 3);
    ctx.fillStyle = gr; ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label + 'h', x + w / 2, pad.t + cH + 16);

    // Val
    if (val > 15) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(Math.round(val) + '%', x + w / 2, y - 3);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   THEME TOGGLE — Dark/Light Mode con animación grid
   ──────────────────────────────────────────────────────────
   Transición cinematográfica por cuadros de grid
════════════════════════════════════════════════════════════ */
function initThemeToggle() {
  const toggle = $('#theme-toggle');
  const overlay = $('#theme-transition-overlay');
  if (!toggle || !overlay) return;

  // Cargar tema guardado
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  }

  // Crear grid cells
  const gridSize = 20;
  const totalCells = gridSize * gridSize;
  
  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    // Delay progresivo desde el centro
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const centerRow = gridSize / 2;
    const centerCol = gridSize / 2;
    const distance = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
    const delay = distance * 0.02; // 20ms por unidad de distancia
    cell.style.animationDelay = `${delay}s`;
    overlay.appendChild(cell);
  }

  toggle.addEventListener('click', () => {
    // Activar overlay
    overlay.classList.add('active');
    
    // Después de 600ms (duración animación), cambiar tema
    setTimeout(() => {
      document.body.classList.toggle('light-mode');
      const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
      localStorage.setItem('theme', theme);
      
      // Remover overlay después de transición
      setTimeout(() => {
        overlay.classList.remove('active');
      }, 100);
    }, 600);
  });
}

/* ════════════════════════════════════════════════════════════
   LANGUAGE DETECTION & AUTO-TRANSLATE
   ──────────────────────────────────────────────────────────
   Detecta país por IP y traduce automáticamente
   Brasil → PT | Países hispanos → ES | Resto → ES (default)
════════════════════════════════════════════════════════════ */

const translations = {
  es: {
    'nav.services': 'Servicios',
    'nav.analytics': 'Analytics',
    'nav.assets': 'Activos',
    'nav.about': 'Nosotros',
    'nav.contact': 'Contacto',
    'nav.cta': 'Hablar con el equipo',
    'meta.title': 'RabbitDev — Automatización & Inteligencia de Datos',
    'meta.description': 'RabbitDev: Startup especializada en automatización, análisis de datos, gestión de activos y control de producción. Tecnología que transforma operaciones.',
    'meta.ogTitle': 'RabbitDev — Move Fast. Build Smart.',
    'meta.ogDescription': 'Automatización, análisis de datos y control de producción para empresas que quieren escalar.',

    'brand.rabbitDev': 'RabbitDev',
    'brand.logo': 'Rabbit<strong>Dev</strong>',
    'brand.sebInitials': 'SZ',
    'brand.italoInitials': 'IA',
    'brand.sebastian': 'Sebastian Zambrano',
    'brand.italo': 'Italo Arruda',
    'unit.hoursShort': 'h',
    'stack.python': 'Python',
    'stack.node': 'Node.js',
    'stack.machineLearning': 'Machine Learning',
    'stack.postgresql': 'PostgreSQL',
    'stack.redis': 'Redis',
    'stack.kafka': 'Kafka',
    'stack.docker': 'Docker',
    'stack.kubernetes': 'Kubernetes',
    'stack.aws': 'AWS',
    'stack.grafana': 'Grafana',
    'stack.dbt': 'dbt',
    'stack.airflow': 'Airflow',
    'stack.powerBi': 'Power BI',
    'stack.restApis': 'APIs REST',
    'stack.nlp': 'NLP',
    'stack.computerVision': 'Visi\u00f3n Computacional',
    'stack.etl': 'ETL/ELT',
    'stack.forecasting': 'Pron\u00f3stico',
    'stack.biReporting': 'BI & Reportes',
    'stack.webApps': 'Apps Web',
    'stack.mobile': 'Mobile',
    'stack.customApis': 'APIs a medida',
    'stack.mes': 'MES',
    'stack.iot': 'IoT',
    'stack.predictiveMaintenance': 'Mantenimiento Predictivo',
    'production.oee1': 'OEE 94%',
    'production.oee2': 'OEE 71%',
    'production.oee3': 'OEE 88%',
    'production.oee4': 'OEE 42%',
    'contact.emailInline': '<span>\u2709</span> rabbit.dev@outlook.pt',
    'contact.whatsappInline': '<span>\ud83d\udcac</span> +55 14 99124-6031',
    'contact.emailLabel': 'Email',
    'contact.emailAddress': 'rabbit.dev@outlook.pt',
    'contact.whatsappLabel': 'WhatsApp',
    'contact.phone': '+55 14 99124-6031',
    'contact.linkedinLabel': 'LinkedIn',
    'aria.nav': 'Navegaci\u00f3n principal',
    'aria.home': 'RabbitDev inicio',
    'aria.theme': 'Cambiar tema',
    'aria.openMenu': 'Abrir men\u00fa',
    'aria.heroTitle': 'RabbitDev \u2014 Move Fast. Build Smart.',
    'aria.analyticsDashboard': 'Dashboard de analytics',
    'aria.productionPanel': 'Panel de control de producci\u00f3n',
    'aria.sendEmail': 'Enviar email',
    'aria.contactWhatsapp': 'Contactar por WhatsApp',
    'aria.linkedinSoon': 'LinkedIn pronto disponible',
    'aria.github': 'GitHub',
    'aria.linkedin': 'LinkedIn',
    'hero.badge': '<span class="badge-pulse"></span> Startup Tech · Especialistas en automatización',
    'hero.title1': 'Move Fast.',
    'hero.title2': 'Build Smart.',
    'hero.subtitle': 'Automatizamos operaciones, analizamos datos en tiempo real y ponemos a trabajar tu infraestructura con herramientas de nivel enterprise — sin la complejidad enterprise.',
    'hero.ctaPrimary': 'Ver qué hacemos',
    'hero.ctaSecondary': 'Agendar demo <span>→</span>',
    'hero.metricRoi': 'ROI promedio',
    'hero.metricUptime': 'Uptime garantizado',
    'hero.metricCosts': 'Reducción de costos',
    'hero.scroll': 'Scroll para explorar',
    'preloader.tagline': 'Inicializando sistemas...',
    'common.explore': 'Explorar <span>→</span>',
    'services.tag': '// lo que construimos',
    'services.title': 'Tecnología que <em>funciona</em><br/>desde el día uno',
    'services.desc': 'No somos consultores que venden presentaciones. Somos devs que entregan sistemas.',
    'services.ai.title': 'Sistema de IAs Integrados',
    'services.ai.desc': 'Modelos de ML personalizados, asistentes inteligentes y automatización cognitiva que aprende de tus datos y optimiza procesos.',
    'services.data.title': 'Análisis y Predicción de Datos',
    'services.data.desc': 'Pipelines de datos en tiempo real, dashboards inteligentes y modelos predictivos que convierten ruido en decisiones accionables.',
    'services.tools.title': 'Herramientas Personalizadas',
    'services.tools.desc': 'Aplicaciones web y móviles a medida. Desde dashboards ejecutivos hasta sistemas de gestión completos adaptados a tu negocio.',
    'services.assets.title': 'Gestión de Activos & Producción',
    'services.assets.desc': 'Sistemas MES, seguimiento IoT en tiempo real, mantenimiento predictivo, OEE automatizado y trazabilidad completa de activos.',
    'data.tag': '// análisis de datos',
    'data.title': 'Tu operación<br/>habla. ¿La estás<br/><em>escuchando?</em>',
    'data.desc': 'Construimos pipelines que consolidan datos de todas tus fuentes — ERP, sensores, logs, APIs — y los transforman en dashboards que responden preguntas antes de que las hagas.',
    'data.feature1': '<span class="feat-check">✓</span> Ingesta en tiempo real con latencia sub-segundo',
    'data.feature2': '<span class="feat-check">✓</span> Modelos ML para detección de anomalías',
    'data.feature3': '<span class="feat-check">✓</span> Alertas contextuales por canal (Slack, email, SMS)',
    'data.feature4': '<span class="feat-check">✓</span> Dashboards auto-actualizados sin refresh manual',
    'data.cta': 'Quiero un diagnóstico gratis',
    'data.dashboardTitle': 'Operations Overview · Live',
    'data.live': '<span class="live-dot"></span>En vivo',
    'data.kpiEvents': 'K eventos/seg',
    'data.kpiAccuracy': '% precisión ML',
    'data.kpiLatency': 'ms latencia',
    'data.anomalyTitle': 'Anomalía detectada',
    'data.anomalyDesc': 'Pico de consumo +34% · Línea 3 · hace 12s',
    'assets.tag': '// gestión de activos',
    'assets.title': 'Cada activo, <em>trazado</em>.<br/>Cada falla, <em>predicha</em>.',
    'assets.stat1': 'Activos monitoreados en simultáneo',
    'assets.stat2': 'Precisión en predicción de fallas',
    'assets.stat3': 'Anticipación promedio antes de falla',
    'assets.stat4': 'Reducción en mantenimiento correctivo',
    'assets.timelineTitle': 'Ciclo de vida de un activo con RabbitDev',
    'assets.tl1.title': 'Registro & onboarding',
    'assets.tl1.desc': 'Catalogación automática vía QR/RFID/API',
    'assets.tl2.title': 'Monitoreo en vivo',
    'assets.tl2.desc': 'Telemetría continua de sensores IoT',
    'assets.tl3.title': 'Predicción de mantenimiento',
    'assets.tl3.desc': 'Modelos ML anticipan fallas 72h antes',
    'assets.tl4.title': 'Orden de trabajo automática',
    'assets.tl4.desc': 'Ticket en CMMS sin intervención humana',
    'assets.tl5.title': 'Cierre & reporte',
    'assets.tl5.desc': 'Historial trazable, exportable, auditable',
    'production.panelTitle': 'Control de Producción · Turno A',
    'production.status': '● Operativo',
    'production.line1': 'Línea 1',
    'production.line2': 'Línea 2',
    'production.line3': 'Línea 3',
    'production.line4': 'Línea 4',
    'production.alertWarn': '<span>⚠</span> Línea 2: Temperatura fuera de rango',
    'production.alertCrit': '<span>🔴</span> Línea 4: Parada no planificada detectada',
    'production.tag': '// control de producción',
    'production.title': 'De cero a<br/><em>OEE 90%</em><br/>en 90 días.',
    'production.desc': 'Nuestro MES conecta con tu PLC, SCADA o ERP existente. No reemplazamos lo que funciona: lo amplificamos con inteligencia.',
    'production.feature1': '<span class="feat-check">✓</span> Integración con Siemens, Rockwell, Mitsubishi',
    'production.feature2': '<span class="feat-check">✓</span> OEE calculado automáticamente por turno',
    'production.feature3': '<span class="feat-check">✓</span> Reportes de calidad con SPC integrado',
    'production.feature4': '<span class="feat-check">✓</span> Dashboard en tablet para operadores en planta',
    'production.cta': 'Ver demo en vivo',
    'contact.tag': '// hablemos',
    'contact.title': '¿Listo para<br/><em>automatizar</em><br/>lo que no debería<br/>ser manual?',
    'contact.desc': 'Una llamada de 30 minutos. Sin pitch de ventas. Solo diagnosticamos qué parte de tu operación tiene mayor ROI potencial.',
    'contact.linkedinSoon': '<span>🔗</span> LinkedIn - Coming soon',
    'contact.comingSoon': 'Coming soon',
    'footer.desc': 'Automatización inteligente para operaciones que no pueden fallar.',
    'footer.services': 'Servicios',
    'footer.data': 'Análisis de Datos',
    'footer.assets': 'Gestión de Activos',
    'footer.production': 'Control de Producción',
    'footer.automation': 'Automatización',
    'footer.company': 'Empresa',
    'footer.about': 'Nosotros',
    'footer.contact': 'Contacto',
    'footer.copyright': '© 2024 RabbitDev. Código limpio, entrega rápida.',
    'footer.made': 'Hecho con 🐇 y demasiado café',
    'about.tag': '// quiénes somos',
    'about.title': 'De la planta<br/>al código.<br/><em>Y viceversa.</em>',
    'about.intro': 'Somos <strong>Sebastian Zambrano</strong> e <strong>Italo Arruda</strong>, dos especialistas que nos cansamos de ver proyectos industriales que prometen todo y entregan poco. Después de años trabajando con sensores, historiadores de datos y sistemas que "deberían funcionar", decidimos armar algo diferente.',
    'about.experience': 'Entre los dos acumulamos <strong>más de 40 proyectos</strong> de implementación de tecnología 4.0 en industrias reales. No hablamos de casos de estudio ni teoría — hablamos de sensores vibrando en ambientes hostiles, PLC\'s que no quieren hablar con nadie, y bases de datos que explotan a las 3 de la mañana.',
    'about.expertise': 'Hemos configurado historiadores de datos que nunca duermen, construido más de <strong>20 automaciones</strong> que siguen corriendo sin que nadie las toque, y desarrollado <strong>+5 sistemas con IA</strong> que realmente interpretan datos (no solo los grafican bonito).',
    'about.mission': 'RabbitDev nació porque creemos que la tecnología industrial no tiene que ser lenta, cara ni complicada. Traemos herramientas nuevas, las implementamos rápido, y nos aseguramos de que funcionen donde importa: <em>en el piso de planta</em>.',
    'about.cta': '¿Tienes un problema industrial que nadie ha podido resolver? Perfecto. <strong>Nos gustan esos.</strong>',
    'about.stat1': 'Proyectos Industria 4.0',
    'about.stat2': 'Automaciones Activas',
    'about.stat3': 'Sistemas con IA',
    'about.stat4': 'Historiadores Corriendo',
    'about.seb.role': 'Co-founder · Especialista en Datos',
    'about.seb.bio': 'Especialista en automatizaciones, banco de datos, gobernanza de datos, herramientas de conectividad multi plataformas y análisis de datos. Si hay datos, los conecto, gobierno y automatizo.',
    'about.italo.role': 'Co-founder · Especialista en Datos',
    'about.italo.bio': 'Especialista en historiador de datos, sensores, herramientas de multiconectividad y desarrollo de herramientas internas. Hago que sistemas industriales hablen entre ellos (aunque no quieran).',
  },
  pt: {
    'nav.services': 'Serviços',
    'nav.analytics': 'Analytics',
    'nav.assets': 'Ativos',
    'nav.about': 'Sobre Nós',
    'nav.contact': 'Contato',
    'nav.cta': 'Falar com a equipe',
    'meta.title': 'RabbitDev — Automação & Inteligência de Dados',
    'meta.description': 'RabbitDev: Startup especializada em automação, análise de dados, gestão de ativos e controle de produção. Tecnologia que transforma operações.',
    'meta.ogTitle': 'RabbitDev — Mova Rápido. Construa Inteligente.',
    'meta.ogDescription': 'Automação, análise de dados e controle de produção para empresas que querem escalar.',

    'brand.rabbitDev': 'RabbitDev',
    'brand.logo': 'Rabbit<strong>Dev</strong>',
    'brand.sebInitials': 'SZ',
    'brand.italoInitials': 'IA',
    'brand.sebastian': 'Sebastian Zambrano',
    'brand.italo': 'Italo Arruda',
    'unit.hoursShort': 'h',
    'stack.python': 'Python',
    'stack.node': 'Node.js',
    'stack.machineLearning': 'Aprendizado de M\u00e1quina',
    'stack.postgresql': 'PostgreSQL',
    'stack.redis': 'Redis',
    'stack.kafka': 'Kafka',
    'stack.docker': 'Docker',
    'stack.kubernetes': 'Kubernetes',
    'stack.aws': 'AWS',
    'stack.grafana': 'Grafana',
    'stack.dbt': 'dbt',
    'stack.airflow': 'Airflow',
    'stack.powerBi': 'Power BI',
    'stack.restApis': 'APIs REST',
    'stack.nlp': 'NLP',
    'stack.computerVision': 'Vis\u00e3o Computacional',
    'stack.etl': 'ETL/ELT',
    'stack.forecasting': 'Previs\u00e3o',
    'stack.biReporting': 'BI & Relat\u00f3rios',
    'stack.webApps': 'Apps Web',
    'stack.mobile': 'Mobile',
    'stack.customApis': 'APIs sob medida',
    'stack.mes': 'MES',
    'stack.iot': 'IoT',
    'stack.predictiveMaintenance': 'Manuten\u00e7\u00e3o Preditiva',
    'production.oee1': 'OEE 94%',
    'production.oee2': 'OEE 71%',
    'production.oee3': 'OEE 88%',
    'production.oee4': 'OEE 42%',
    'contact.emailInline': '<span>\u2709</span> rabbit.dev@outlook.pt',
    'contact.whatsappInline': '<span>\ud83d\udcac</span> +55 14 99124-6031',
    'contact.emailLabel': 'Email',
    'contact.emailAddress': 'rabbit.dev@outlook.pt',
    'contact.whatsappLabel': 'WhatsApp',
    'contact.phone': '+55 14 99124-6031',
    'contact.linkedinLabel': 'LinkedIn',
    'aria.nav': 'Navega\u00e7\u00e3o principal',
    'aria.home': 'In\u00edcio RabbitDev',
    'aria.theme': 'Mudar tema',
    'aria.openMenu': 'Abrir menu',
    'aria.heroTitle': 'RabbitDev \u2014 Mova R\u00e1pido. Construa Inteligente.',
    'aria.analyticsDashboard': 'Dashboard de analytics',
    'aria.productionPanel': 'Painel de controle de produ\u00e7\u00e3o',
    'aria.sendEmail': 'Enviar email',
    'aria.contactWhatsapp': 'Entrar em contato pelo WhatsApp',
    'aria.linkedinSoon': 'LinkedIn em breve',
    'aria.github': 'GitHub',
    'aria.linkedin': 'LinkedIn',
    'hero.badge': '<span class="badge-pulse"></span> Startup Tech · Especialistas em automação',
    'hero.title1': 'Mova Rápido.',
    'hero.title2': 'Construa Inteligente.',
    'hero.subtitle': 'Automatizamos operações, analisamos dados em tempo real e colocamos sua infraestrutura para trabalhar com ferramentas de nível enterprise — sem a complexidade enterprise.',
    'hero.ctaPrimary': 'Ver o que fazemos',
    'hero.ctaSecondary': 'Agendar demo <span>→</span>',
    'hero.metricRoi': 'ROI médio',
    'hero.metricUptime': 'Uptime garantido',
    'hero.metricCosts': 'Redução de custos',
    'hero.scroll': 'Scroll para explorar',
    'preloader.tagline': 'Inicializando sistemas...',
    'common.explore': 'Explorar <span>→</span>',
    'services.tag': '// o que construímos',
    'services.title': 'Tecnologia que <em>funciona</em><br/>desde o primeiro dia',
    'services.desc': 'Não somos consultores que vendem apresentações. Somos devs que entregam sistemas.',
    'services.ai.title': 'Sistema de IAs Integradas',
    'services.ai.desc': 'Modelos de ML personalizados, assistentes inteligentes e automação cognitiva que aprende com seus dados e otimiza processos.',
    'services.data.title': 'Análise e Predição de Dados',
    'services.data.desc': 'Pipelines de dados em tempo real, dashboards inteligentes e modelos preditivos que transformam ruído em decisões acionáveis.',
    'services.tools.title': 'Ferramentas Personalizadas',
    'services.tools.desc': 'Aplicações web e mobile sob medida. De dashboards executivos a sistemas completos de gestão adaptados ao seu negócio.',
    'services.assets.title': 'Gestão de Ativos & Produção',
    'services.assets.desc': 'Sistemas MES, acompanhamento IoT em tempo real, manutenção preditiva, OEE automatizado e rastreabilidade completa de ativos.',
    'data.tag': '// análise de dados',
    'data.title': 'Sua operação<br/>fala. Você está<br/><em>escutando?</em>',
    'data.desc': 'Construímos pipelines que consolidam dados de todas as suas fontes — ERP, sensores, logs, APIs — e os transformam em dashboards que respondem perguntas antes que você faça.',
    'data.feature1': '<span class="feat-check">✓</span> Ingestão em tempo real com latência sub-segundo',
    'data.feature2': '<span class="feat-check">✓</span> Modelos ML para detecção de anomalias',
    'data.feature3': '<span class="feat-check">✓</span> Alertas contextuais por canal (Slack, email, SMS)',
    'data.feature4': '<span class="feat-check">✓</span> Dashboards autoatualizados sem refresh manual',
    'data.cta': 'Quero um diagnóstico grátis',
    'data.dashboardTitle': 'Visão Operacional · Ao vivo',
    'data.live': '<span class="live-dot"></span>Ao vivo',
    'data.kpiEvents': 'K eventos/seg',
    'data.kpiAccuracy': '% precisão ML',
    'data.kpiLatency': 'ms latência',
    'data.anomalyTitle': 'Anomalia detectada',
    'data.anomalyDesc': 'Pico de consumo +34% · Linha 3 · há 12s',
    'assets.tag': '// gestão de ativos',
    'assets.title': 'Cada ativo, <em>rastreado</em>.<br/>Cada falha, <em>prevista</em>.',
    'assets.stat1': 'Ativos monitorados simultaneamente',
    'assets.stat2': 'Precisão na predição de falhas',
    'assets.stat3': 'Antecipação média antes da falha',
    'assets.stat4': 'Redução em manutenção corretiva',
    'assets.timelineTitle': 'Ciclo de vida de um ativo com RabbitDev',
    'assets.tl1.title': 'Registro & onboarding',
    'assets.tl1.desc': 'Catalogação automática via QR/RFID/API',
    'assets.tl2.title': 'Monitoramento ao vivo',
    'assets.tl2.desc': 'Telemetria contínua de sensores IoT',
    'assets.tl3.title': 'Predição de manutenção',
    'assets.tl3.desc': 'Modelos ML antecipam falhas 72h antes',
    'assets.tl4.title': 'Ordem de trabalho automática',
    'assets.tl4.desc': 'Ticket no CMMS sem intervenção humana',
    'assets.tl5.title': 'Fechamento & relatório',
    'assets.tl5.desc': 'Histórico rastreável, exportável e auditável',
    'production.panelTitle': 'Controle de Produção · Turno A',
    'production.status': '● Operando',
    'production.line1': 'Linha 1',
    'production.line2': 'Linha 2',
    'production.line3': 'Linha 3',
    'production.line4': 'Linha 4',
    'production.alertWarn': '<span>⚠</span> Linha 2: Temperatura fora da faixa',
    'production.alertCrit': '<span>🔴</span> Linha 4: Parada não planejada detectada',
    'production.tag': '// controle de produção',
    'production.title': 'De zero a<br/><em>OEE 90%</em><br/>em 90 dias.',
    'production.desc': 'Nosso MES conecta com seu PLC, SCADA ou ERP existente. Não substituímos o que funciona: amplificamos com inteligência.',
    'production.feature1': '<span class="feat-check">✓</span> Integração com Siemens, Rockwell, Mitsubishi',
    'production.feature2': '<span class="feat-check">✓</span> OEE calculado automaticamente por turno',
    'production.feature3': '<span class="feat-check">✓</span> Relatórios de qualidade com SPC integrado',
    'production.feature4': '<span class="feat-check">✓</span> Dashboard em tablet para operadores na planta',
    'production.cta': 'Ver demo ao vivo',
    'contact.tag': '// vamos conversar',
    'contact.title': 'Pronto para<br/><em>automatizar</em><br/>o que não deveria<br/>ser manual?',
    'contact.desc': 'Uma chamada de 30 minutos. Sem pitch de vendas. Apenas diagnosticamos qual parte da sua operação tem maior potencial de ROI.',
    'contact.linkedinSoon': '<span>🔗</span> LinkedIn - Em breve',
    'contact.comingSoon': 'Em breve',
    'footer.desc': 'Automação inteligente para operações que não podem falhar.',
    'footer.services': 'Serviços',
    'footer.data': 'Análise de Dados',
    'footer.assets': 'Gestão de Ativos',
    'footer.production': 'Controle de Produção',
    'footer.automation': 'Automação',
    'footer.company': 'Empresa',
    'footer.about': 'Sobre nós',
    'footer.contact': 'Contato',
    'footer.copyright': '© 2024 RabbitDev. Código limpo, entrega rápida.',
    'footer.made': 'Feito com 🐇 e café demais',
    'about.tag': '// quem somos',
    'about.title': 'Da planta<br/>ao código.<br/><em>E vice-versa.</em>',
    'about.intro': 'Somos <strong>Sebastian Zambrano</strong> e <strong>Italo Arruda</strong>, dois especialistas que nos cansamos de ver projetos industriais que prometem tudo e entregam pouco. Depois de anos trabalhando com sensores, historiadores de dados e sistemas que "deveriam funcionar", decidimos criar algo diferente.',
    'about.experience': 'Entre nós dois acumulamos <strong>mais de 40 projetos</strong> de implementação de tecnologia 4.0 em indústrias reais. Não falamos de casos de estudo nem teoria — falamos de sensores vibrando em ambientes hostis, PLC\'s que não querem falar com ninguém, e bancos de dados que explodem às 3 da manhã.',
    'about.expertise': 'Configuramos historiadores de dados que nunca dormem, construímos mais de <strong>20 automações</strong> que continuam rodando sem que ninguém as toque, e desenvolvemos <strong>+5 sistemas com IA</strong> que realmente interpretam dados (não apenas os plotam bonito).',
    'about.mission': 'RabbitDev nasceu porque acreditamos que a tecnologia industrial não precisa ser lenta, cara nem complicada. Trazemos ferramentas novas, implementamos rápido, e garantimos que funcionem onde importa: <em>no chão de fábrica</em>.',
    'about.cta': 'Tem um problema industrial que ninguém conseguiu resolver? Perfeito. <strong>Nós gostamos desses.</strong>',
    'about.stat1': 'Projetos Indústria 4.0',
    'about.stat2': 'Automações Ativas',
    'about.stat3': 'Sistemas com IA',
    'about.stat4': 'Historiadores Rodando',
    'about.seb.role': 'Co-fundador · Especialista em Dados',
    'about.seb.bio': 'Especialista em automações, banco de dados, governança de dados, ferramentas de conectividade multi plataformas e análise de dados. Se tem dados, eu conecto, governo e automatizo.',
    'about.italo.role': 'Co-fundador · Especialista em Dados',
    'about.italo.bio': 'Especialista em historiador de dados, sensores, ferramentas de multiconectividade e desenvolvimento de ferramentas internas. Faço sistemas industriais conversarem entre si (mesmo quando não querem).',
  }
};

const I18N_DEBUG = true;
const I18N_STORAGE_VERSION = '2026-05-02:auto-ip-v2';
const I18N_HISPANIC_COUNTRIES = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT',
  'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'ES', 'UY', 'VE'
]);

function i18nLog(message, data = {}) {
  if (!I18N_DEBUG) return;
  console.info(`[RabbitDev i18n] ${message}`, data);
}

function getBrowserLanguage() {
  const raw = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
  const lang = raw.toLowerCase().startsWith('pt') ? 'pt' : 'es';
  return { raw, lang };
}

function languageFromCountry(countryCode, fallbackLang = 'es') {
  const country = String(countryCode || '').toUpperCase();
  if (country === 'BR' || country === 'PT') return 'pt';
  if (I18N_HISPANIC_COUNTRIES.has(country)) return 'es';
  return fallbackLang;
}

function persistLanguage(lang, meta = {}) {
  localStorage.setItem('language', lang);
  localStorage.setItem('languageMeta', JSON.stringify({
    source: meta.source || 'auto',
    country: meta.country || null,
    browser: meta.browser || null,
    version: I18N_STORAGE_VERSION,
    detectedAt: new Date().toISOString(),
  }));
}

function readLanguageMeta() {
  try {
    return JSON.parse(localStorage.getItem('languageMeta') || 'null');
  } catch (err) {
    return null;
  }
}

function detectLanguage() {
  const savedLang = localStorage.getItem('language');
  const savedMeta = readLanguageMeta();
  const browser = getBrowserLanguage();

  // Old saved values caused Brazil users to stay stuck in ES forever.
  const hasFreshAutoDetection = savedLang && savedMeta && savedMeta.version === I18N_STORAGE_VERSION;
  if (hasFreshAutoDetection) {
    applyTranslations(savedLang, { source: 'localStorage', meta: savedMeta });
    i18nLog('Using saved language', { savedLang, savedMeta });
    return;
  }

  if (savedLang && !savedMeta) {
    i18nLog('Ignoring legacy saved language and re-detecting', { savedLang });
  }

  // Apply browser hint immediately to avoid a visible ES flash for pt-BR browsers.
  applyTranslations(browser.lang, { source: 'browser-preflight', browser: browser.raw });

  fetch('https://ipapi.co/json/')
    .then(res => {
      if (!res.ok) throw new Error(`ipapi HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const country = data.country_code || data.country || '';
      const lang = languageFromCountry(country, browser.lang);
      persistLanguage(lang, { source: 'ipapi', country, browser: browser.raw });
      applyTranslations(lang, { source: 'ipapi', country, browser: browser.raw });
      i18nLog('IP detection completed', { country, browser: browser.raw, lang, raw: data });
    })
    .catch(err => {
      persistLanguage(browser.lang, { source: 'browser-fallback', browser: browser.raw });
      applyTranslations(browser.lang, { source: 'browser-fallback', browser: browser.raw, error: err.message });
      console.warn('[RabbitDev i18n] IP detection failed; using browser language fallback.', err);
    });
}

function applyTranslations(lang, debug = {}) {
  const normalizedLang = translations[lang] ? lang : 'es';
  const trans = translations[normalizedLang] || translations.es;
  let translated = 0;
  let translatedAttrs = 0;
  let missing = [];

  $$('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = trans[key];
    if (!value) {
      missing.push(key);
      return;
    }

    if (el.classList.contains('ht-line')) {
      el.dataset.text = value;
      const inner = $('.ht-line-inner', el);
      if (inner) inner.textContent = value;
      else el.textContent = value;
    } else {
      el.innerHTML = value;
    }
    translated += 1;
  });

  [
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-title', 'title']
  ].forEach(([keyAttr, targetAttr]) => {
    $$(`[${keyAttr}]`).forEach(el => {
      const key = el.getAttribute(keyAttr);
      const value = trans[key];
      if (!value) {
        missing.push(`${targetAttr}:${key}`);
        return;
      }

      el.setAttribute(targetAttr, value);
      translatedAttrs += 1;
    });
  });

  document.documentElement.lang = normalizedLang;
  document.documentElement.dataset.langSource = debug.source || 'unknown';

  document.title = trans['meta.title'] || document.title;
  const metaDescription = $('meta[name="description"]');
  if (metaDescription && trans['meta.description']) {
    metaDescription.setAttribute('content', trans['meta.description']);
  }

  const ogTitle = $('meta[property="og:title"]');
  if (ogTitle && trans['meta.ogTitle']) {
    ogTitle.setAttribute('content', trans['meta.ogTitle']);
  }

  const ogDescription = $('meta[property="og:description"]');
  if (ogDescription && trans['meta.ogDescription']) {
    ogDescription.setAttribute('content', trans['meta.ogDescription']);
  }

  i18nLog('Applied translations', { lang: normalizedLang, translated, translatedAttrs, missing, ...debug });
}

window.RabbitDevI18n = {
  redetect() {
    localStorage.removeItem('language');
    localStorage.removeItem('languageMeta');
    detectLanguage();
  },
  setLanguage(lang) {
    const normalizedLang = translations[lang] ? lang : 'es';
    persistLanguage(normalizedLang, { source: 'manual', browser: navigator.language || null });
    applyTranslations(normalizedLang, { source: 'manual' });
  },
  current() {
    return {
      lang: localStorage.getItem('language') || document.documentElement.lang,
      meta: readLanguageMeta(),
      htmlLang: document.documentElement.lang,
      source: document.documentElement.dataset.langSource || null,
    };
  },
};

/* ════════════════════════════════════════════════════════════
   INIT — secuencia correcta
════════════════════════════════════════════════════════════ */
function boot() {
  initLenis();           // Smooth scroll cinematográfico (primero)
  initThemeToggle();     // Toggle dark/light con animación grid
  detectLanguage();      // Detectar idioma y traducir automáticamente
  initGalaxy();          // Supernova Rabbit para modo oscuro
  initRabbitConstruction(); // Construccion Rabbit solo en modo claro
  initCursor();          // Cursor inmediato
  initNavbar();          // Navbar inmediato
  initParallaxLayers();  // Parallax layers
  initMagnetic();        // Botones magnéticos

  // Después del preloader
  initPreloader(() => {
    document.body.classList.add('loaded');
    initHeroReveal();    // Texto hero
    initReveals();       // Scroll reveals
    initCounters();      // Contadores
    initDashboardKPIs(); // KPIs + chart data
    initProdChart();     // Chart producción
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
