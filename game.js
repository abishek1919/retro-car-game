/* ═══════════════════════════════════════════════════════════════════
   STREET RUSH — Endless Racer  |  HTML5 Canvas Game
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";

// ── Canvas Setup ──────────────────────────────────────────────────
const cvs = document.getElementById("gameCanvas");
const ctx = cvs.getContext("2d");
let W, H, scale;

function resize() {
  W = cvs.width  = window.innerWidth  * devicePixelRatio;
  H = cvs.height = window.innerHeight * devicePixelRatio;
  scale = Math.min(W, H) / 800;
  ctx.imageSmoothingEnabled = true;
}
window.addEventListener("resize", resize);
resize();

// ── Constants ─────────────────────────────────────────────────────
const LANE_COUNT   = 3;
const BASE_SPEED   = 5;
const MAX_SPEED    = 18;
const ACCEL        = 0.04;
const BRAKE_FORCE  = 0.08;
const FRICTION     = 0.005;
const LANE_SWITCH_SPEED = 0.12;

// Road geometry (proportional)
const ROAD_W_TOP    = 0.12;   // road width at horizon (fraction of W)
const ROAD_W_BOTTOM = 0.70;   // road width at bottom
const HORIZON_Y     = 0.38;   // horizon line (fraction of H)

// Obstacle types
const OBS_CAR    = 0;
const OBS_TRUCK  = 1;
const OBS_BARREL = 2;
const OBS_CONE   = 3;

const OBS_CONFIGS = [
  { type: OBS_CAR,    wFrac: 0.13, hFrac: 0.07, label: "car" },
  { type: OBS_TRUCK,  wFrac: 0.14, hFrac: 0.10, label: "truck" },
  { type: OBS_BARREL, wFrac: 0.05, hFrac: 0.04, label: "barrel" },
  { type: OBS_CONE,   wFrac: 0.04, hFrac: 0.035, label: "cone" },
];

// ── Colors & Climate ──
let SKY_TOP      = "#0b0e2a";
let SKY_BOTTOM   = "#1a1040";
let ROAD_COLOR   = "#2a2a2a";
let ROAD_EDGE    = "#ffcc00";
let STRIPE_WHITE = "#ffffff";
let GRASS_LIGHT  = "#1a6b10";
let GRASS_DARK   = "#145a0c";
let SHOULDER_RED = "#cc2222";
let SHOULDER_WHT = "#dddddd";

let MOUNTAIN_TINT = "rgba(0,0,0,0)";
let TREE_L_MULT = 1.0;
let SUN_Y = 1.2;
let MOON_Y = 0.15;
let STAR_ALPHA = 1.0;

const CLIMATE_STATES = [
  // 0: Morning
  {
    skyTop: [57, 72, 108], skyBot: [230, 141, 94],
    road: [50, 45, 45], edge: [255, 204, 0], stripe: [255, 240, 230],
    grassL: [30, 110, 30], grassD: [20, 90, 20],
    shRed: [204, 34, 34], shWht: [221, 200, 190],
    sunY: 0.20, moonY: 1.2, starAlpha: 0.1, treeL: 0.7,
    mTnt: [255, 100, 50, 0.3]
  },
  // 1: Day
  {
    skyTop: [78, 168, 222], skyBot: [144, 224, 239],
    road: [60, 60, 60], edge: [255, 220, 0], stripe: [255, 255, 255],
    grassL: [40, 150, 40], grassD: [25, 120, 25],
    shRed: [220, 40, 40], shWht: [240, 240, 240],
    sunY: 0.05, moonY: 1.2, starAlpha: 0.0, treeL: 1.0,
    mTnt: [0, 0, 0, 0]
  },
  // 2: Sunset
  {
    skyTop: [58, 12, 163], skyBot: [247, 37, 133],
    road: [40, 30, 40], edge: [255, 150, 0], stripe: [255, 200, 200],
    grassL: [35, 90, 35], grassD: [25, 70, 25],
    shRed: [180, 20, 50], shWht: [200, 150, 150],
    sunY: 0.25, moonY: 1.2, starAlpha: 0.3, treeL: 0.6,
    mTnt: [200, 0, 100, 0.4]
  },
  // 3: Night
  {
    skyTop: [11, 14, 42], skyBot: [26, 16, 64],
    road: [20, 20, 25], edge: [150, 100, 0], stripe: [100, 100, 120],
    grassL: [15, 50, 20], grassD: [10, 40, 15],
    shRed: [100, 10, 10], shWht: [100, 100, 110],
    sunY: 1.2, moonY: 0.15, starAlpha: 1.0, treeL: 0.3,
    mTnt: [0, 0, 50, 0.6]
  }
];

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}
function toRGB(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function toRGBA(c) { return `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`; }

function updateClimate() {
  const cycleLen = 15000;
  let phase = ((distance + 3750) % cycleLen) / cycleLen; // Starts near Morning
  if (state === "MENU") phase = ((gameTime*100 + 3750) % cycleLen) / cycleLen;
  
  const stateCount = CLIMATE_STATES.length;
  const idx1 = Math.floor(phase * stateCount);
  const idx2 = (idx1 + 1) % stateCount;
  const t = (phase * stateCount) - idx1;
  const s1 = CLIMATE_STATES[idx1];
  const s2 = CLIMATE_STATES[idx2];
  
  SKY_TOP = toRGB(lerpColor(s1.skyTop, s2.skyTop, t));
  SKY_BOTTOM = toRGB(lerpColor(s1.skyBot, s2.skyBot, t));
  ROAD_COLOR = toRGB(lerpColor(s1.road, s2.road, t));
  ROAD_EDGE = toRGB(lerpColor(s1.edge, s2.edge, t));
  STRIPE_WHITE = toRGB(lerpColor(s1.stripe, s2.stripe, t));
  GRASS_LIGHT = toRGB(lerpColor(s1.grassL, s2.grassL, t));
  GRASS_DARK = toRGB(lerpColor(s1.grassD, s2.grassD, t));
  SHOULDER_RED = toRGB(lerpColor(s1.shRed, s2.shRed, t));
  SHOULDER_WHT = toRGB(lerpColor(s1.shWht, s2.shWht, t));
  
  SUN_Y = s1.sunY + (s2.sunY - s1.sunY) * t;
  MOON_Y = s1.moonY + (s2.moonY - s1.moonY) * t;
  STAR_ALPHA = s1.starAlpha + (s2.starAlpha - s1.starAlpha) * t;
  TREE_L_MULT = s1.treeL + (s2.treeL - s1.treeL) * t;
  
  const mTnt = [
    s1.mTnt[0] + (s2.mTnt[0] - s1.mTnt[0]) * t,
    s1.mTnt[1] + (s2.mTnt[1] - s1.mTnt[1]) * t,
    s1.mTnt[2] + (s2.mTnt[2] - s1.mTnt[2]) * t,
    s1.mTnt[3] + (s2.mTnt[3] - s1.mTnt[3]) * t,
  ];
  MOUNTAIN_TINT = toRGBA(mTnt);
}

const CAR_COLORS = ["#ff3333","#3399ff","#ffcc00","#33cc66","#ff66cc","#ff8800","#aa44ff"];
const TRUCK_COLORS = ["#6b4c2a","#555555","#336699","#994422"];

// ── Game State ────────────────────────────────────────────────────
let state = "MENU"; // MENU | PLAYING | GAME_OVER
let score = 0;
let distance = 0;
let highScore = parseInt(localStorage.getItem("sr_hi") || "0", 10);
let speed = BASE_SPEED;
let playerLane = 1;       // 0=left, 1=center, 2=right
let playerLaneSmooth = 1; // smooth interpolation
let obstacles = [];
let particles = [];
let spawnTimer = 0;
let gameTime = 0;
let roadOffset = 0;
let cloudOffset = 0;
let shakeTimer = 0;
let shakeIntensity = 0;
let starField = [];
let mountains = [];
let treePositions = [];
let lastTimestamp = 0;
let comboMultiplier = 1;
let nearMissTimer = 0;
let nearMissFlash = 0;

// Input state
const keys = {};
let touchLeft = false;
let touchRight = false;
let touchUp = false;
let touchDown = false;

// ── Initialize static scenery ─────────────────────────────────────
function initScenery() {
  starField = [];
  for (let i = 0; i < 120; i++) {
    starField.push({
      x: Math.random(), y: Math.random() * 0.38,
      s: Math.random() * 1.8 + 0.5, b: Math.random()
    });
  }
  mountains = [];
  for (let i = 0; i < 8; i++) {
    mountains.push({
      x: i / 8, w: 0.12 + Math.random() * 0.1,
      h: 0.06 + Math.random() * 0.08,
      color: `hsl(${220 + Math.random()*30}, ${20+Math.random()*15}%, ${12+Math.random()*10}%)`
    });
  }
  treePositions = [];
  for (let i = 0; i < 40; i++) {
    treePositions.push({
      side: Math.random() > 0.5 ? 1 : -1,
      z: Math.random(),
      size: 0.6 + Math.random() * 0.8,
      hue: 100 + Math.random() * 40
    });
  }
}
initScenery();

// ── Input Handling ────────────────────────────────────────────────
window.addEventListener("keydown", e => { keys[e.code] = true; e.preventDefault(); });
window.addEventListener("keyup",   e => { keys[e.code] = false; });

function handleTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rx = t.clientX / window.innerWidth;
    const ry = t.clientY / window.innerHeight;
    if (ry < 0.25) { touchUp = true; }
    else if (ry > 0.85) { touchDown = true; }
    else if (rx < 0.40) { touchLeft = true; }
    else if (rx > 0.60) { touchRight = true; }
    else { touchUp = true; } // center tap = accelerate
  }
}
function handleTouchEnd(e) {
  e.preventDefault();
  // simple: clear all on any lift (multiple finger tracking is complex)
  if (e.touches.length === 0) {
    touchLeft = touchRight = touchUp = touchDown = false;
  }
}
function handleTap(e) {
  e.preventDefault();
  if (state === "MENU" || state === "GAME_OVER") {
    startGame();
    return;
  }
  for (const t of e.changedTouches) {
    const rx = t.clientX / window.innerWidth;
    if (rx < 0.45) changeLane(-1);
    else if (rx > 0.55) changeLane(1);
  }
}

cvs.addEventListener("touchstart", (e) => {
  if (state !== "PLAYING") { handleTap(e); return; }
  handleTap(e);
  handleTouchStart(e);
}, { passive: false });
cvs.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
cvs.addEventListener("touchend", handleTouchEnd, { passive: false });

// Mouse click fallback for desktop
cvs.addEventListener("mousedown", e => {
  if (state === "MENU" || state === "GAME_OVER") { startGame(); return; }
  const rx = e.clientX / window.innerWidth;
  if (rx < 0.45) changeLane(-1);
  else if (rx > 0.55) changeLane(1);
});

function changeLane(dir) {
  const next = playerLane + dir;
  if (next >= 0 && next < LANE_COUNT) playerLane = next;
}

function processInput(dt) {
  if (state !== "PLAYING") return;

  // Keyboard lane switching (debounced via keydown)
  if (keys["ArrowLeft"]  || keys["KeyA"]) { changeLane(-1); keys["ArrowLeft"] = false; keys["KeyA"] = false; }
  if (keys["ArrowRight"] || keys["KeyD"]) { changeLane(1);  keys["ArrowRight"] = false; keys["KeyD"] = false; }

  // Speed control
  if (keys["ArrowUp"] || keys["KeyW"] || touchUp) {
    speed = Math.min(speed + ACCEL, MAX_SPEED);
  } else if (keys["ArrowDown"] || keys["KeyS"] || touchDown) {
    speed = Math.max(speed - BRAKE_FORCE, BASE_SPEED * 0.5);
  } else {
    speed = Math.max(speed - FRICTION, BASE_SPEED);
  }

  // Smooth lane interpolation
  const diff = playerLane - playerLaneSmooth;
  playerLaneSmooth += diff * LANE_SWITCH_SPEED;
}

// ── Start / Reset Game ────────────────────────────────────────────
function startGame() {
  state = "PLAYING";
  score = 0;
  distance = 0;
  speed = BASE_SPEED;
  playerLane = 1;
  playerLaneSmooth = 1;
  obstacles = [];
  particles = [];
  spawnTimer = 0;
  gameTime = 0;
  roadOffset = 0;
  shakeTimer = 0;
  comboMultiplier = 1;
  nearMissTimer = 0;
}

// ── Obstacle Spawning ─────────────────────────────────────────────
function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const difficulty = Math.min(gameTime / 60, 1); // ramps over 60s

  // Weighted random obstacle type
  let typeIdx;
  const r = Math.random();
  if (r < 0.40) typeIdx = OBS_CAR;
  else if (r < 0.65) typeIdx = OBS_TRUCK;
  else if (r < 0.85) typeIdx = OBS_BARREL;
  else typeIdx = OBS_CONE;

  const cfg = OBS_CONFIGS[typeIdx];
  const obsSpeed = (0.3 + Math.random() * 0.4) * speed; // slower than player

  obstacles.push({
    lane,
    z: 0.01,  // starts at horizon
    type: typeIdx,
    speed: obsSpeed,
    color: typeIdx === OBS_CAR ? CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)]
         : typeIdx === OBS_TRUCK ? TRUCK_COLORS[Math.floor(Math.random()*TRUCK_COLORS.length)]
         : "#ff6600",
    passed: false,
    wFrac: cfg.wFrac,
    hFrac: cfg.hFrac,
  });
}

// ── Collision Detection ───────────────────────────────────────────
function checkCollisions() {
  const playerZ = 0.88; // player's z-position (near bottom)
  const playerW = 0.12;
  const collisionZone = 0.06;

  for (const obs of obstacles) {
    if (obs.passed) continue;
    if (Math.abs(obs.z - playerZ) < collisionZone) {
      // Check lane overlap
      const playerLanePos = playerLaneSmooth;
      const obsLanePos = obs.lane;
      const laneDist = Math.abs(playerLanePos - obsLanePos);

      if (laneDist < 0.6) {
        // HIT!
        gameOver();
        return;
      }

      // Near miss scoring
      if (laneDist < 1.1 && !obs.passed) {
        nearMissTimer = 0.5;
        nearMissFlash = 1;
        score += 25 * comboMultiplier;
        comboMultiplier = Math.min(comboMultiplier + 0.5, 5);
      }
    }

    if (obs.z > playerZ + collisionZone && !obs.passed) {
      obs.passed = true;
      score += Math.floor(10 * comboMultiplier);
    }
  }
}

function gameOver() {
  state = "GAME_OVER";
  shakeTimer = 0.5;
  shakeIntensity = 15;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("sr_hi", String(highScore));
  }

  // Crash particles
  const px = laneToX(playerLaneSmooth, 0.88);
  const py = 0.88 * H;
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 6;
    particles.push({
      x: px, y: py,
      vx: Math.cos(angle) * spd * scale,
      vy: Math.sin(angle) * spd * scale - 3 * scale,
      life: 0.6 + Math.random() * 0.8,
      maxLife: 0.6 + Math.random() * 0.8,
      color: ["#ff4400","#ffaa00","#ff0000","#ffff00","#ffffff"][Math.floor(Math.random()*5)],
      size: 2 + Math.random() * 5
    });
  }
}

// ── Coordinate Helpers ────────────────────────────────────────────
function laneToX(lane, z) {
  // z: 0 = horizon, 1 = bottom
  const horizonX = W / 2;
  const roadWidthAtZ = lerp(ROAD_W_TOP * W, ROAD_W_BOTTOM * W, z);
  const laneWidth = roadWidthAtZ / LANE_COUNT;
  const roadLeft = horizonX - roadWidthAtZ / 2;
  return roadLeft + laneWidth * (lane + 0.5);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Update ────────────────────────────────────────────────────────
function update(dt) {
  if (state !== "PLAYING") {
    // Update particles even when not playing
    updateParticles(dt);
    return;
  }

  gameTime += dt;
  processInput(dt);

  // Distance & score
  distance += speed * dt * 10;
  score += Math.floor(speed * dt * 2);

  // Road scroll
  roadOffset += speed * dt * 0.15;
  if (roadOffset > 1) roadOffset -= 1;

  // Cloud scroll
  cloudOffset += dt * 0.005;

  // Combo decay
  if (nearMissTimer > 0) {
    nearMissTimer -= dt;
    nearMissFlash -= dt * 3;
  } else {
    comboMultiplier = Math.max(1, comboMultiplier - dt * 0.3);
  }

  // Spawn obstacles
  const spawnInterval = Math.max(0.4, 1.8 - gameTime * 0.012);
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    // Chance for double spawn at higher difficulty
    if (Math.random() < Math.min(gameTime / 120, 0.5)) {
      spawnObstacle();
    }
    spawnTimer = spawnInterval;
  }

  // Move obstacles toward player
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.z += (speed - obs.speed * 0.3) * dt * 0.018;
    if (obs.z > 1.2) { obstacles.splice(i, 1); continue; }
  }

  checkCollisions();

  // Shake decay
  if (shakeTimer > 0) shakeTimer -= dt;

  // Exhaust particles
  if (Math.random() < 0.3 + speed * 0.02) {
    const px = laneToX(playerLaneSmooth, 0.90);
    particles.push({
      x: px + (Math.random()-0.5) * 6 * scale,
      y: 0.93 * H,
      vx: (Math.random()-0.5) * 1 * scale,
      vy: 1.5 * scale,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.3 + Math.random() * 0.3,
      color: `rgba(180,180,180,0.4)`,
      size: 2 + Math.random() * 3
    });
  }

  updateParticles(dt);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); }
  }
}

// ── Drawing ───────────────────────────────────────────────────────

function draw() {
  updateClimate();
  ctx.save();

  // Screen shake
  if (shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * shakeIntensity * scale;
    const sy = (Math.random() - 0.5) * shakeIntensity * scale;
    ctx.translate(sx, sy);
  }

  drawSky();
  drawMountains();
  drawRoad();
  drawTrees();
  drawObstacles();
  drawPlayer();
  drawParticles();
  drawHUD();

  if (state === "MENU") drawMenuOverlay();
  if (state === "GAME_OVER") drawGameOverOverlay();

  // Touch zone indicators (mobile)
  if ("ontouchstart" in window && state === "PLAYING") drawTouchZones();

  ctx.restore();
}

// ── Sky ──
function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y * H);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HORIZON_Y * H);

  // Stars
  if (STAR_ALPHA > 0.01) {
    for (const s of starField) {
      const twinkle = 0.5 + 0.5 * Math.sin(gameTime * 3 + s.b * 10);
      ctx.globalAlpha = twinkle * STAR_ALPHA;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.s * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Moon
  if (MOON_Y < 1.0) {
    const moonX = W * 0.78;
    const moonY = H * MOON_Y;
    const moonR = 25 * scale;
    const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2);
    moonGrad.addColorStop(0, "rgba(255,255,220,0.3)");
    moonGrad.addColorStop(1, "rgba(255,255,220,0)");
    ctx.fillStyle = moonGrad;
    ctx.fillRect(moonX - moonR * 2, moonY - moonR * 2, moonR * 4, moonR * 4);
    ctx.fillStyle = "#fffff0";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sun
  if (SUN_Y < 1.0) {
    const sunX = W * 0.22;
    const sunY = H * SUN_Y;
    const sunR = 35 * scale;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
    sunGrad.addColorStop(0, "rgba(255,220,100,0.4)");
    sunGrad.addColorStop(1, "rgba(255,220,100,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
    ctx.fillStyle = "#ffdd55";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Mountains ──
function drawMountains() {
  const baseY = HORIZON_Y * H;
  for (const m of mountains) {
    const mx = ((m.x + cloudOffset * 0.02) % 1.3 - 0.15) * W;
    const mw = m.w * W;
    const mh = m.h * H;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(mx - mw, baseY);
    ctx.lineTo(mx, baseY - mh);
    ctx.lineTo(mx + mw, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MOUNTAIN_TINT;
    ctx.fill();
  }

  // Horizon glow
  const horizGrad = ctx.createLinearGradient(0, baseY - 20 * scale, 0, baseY + 10 * scale);
  horizGrad.addColorStop(0, "rgba(255,140,50,0.08)");
  horizGrad.addColorStop(1, "rgba(255,140,50,0)");
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, baseY - 20 * scale, W, 30 * scale);
}

// ── Road ──
function drawRoad() {
  const hY = HORIZON_Y * H;
  const roadH = H - hY;
  const segCount = 60;

  for (let i = 0; i < segCount; i++) {
    const z0 = i / segCount;
    const z1 = (i + 1) / segCount;
    const y0 = hY + z0 * roadH;
    const y1 = hY + z1 * roadH;

    const rw0 = lerp(ROAD_W_TOP * W, ROAD_W_BOTTOM * W, z0);
    const rw1 = lerp(ROAD_W_TOP * W, ROAD_W_BOTTOM * W, z1);

    const cx = W / 2;

    // Grass (alternating for speed feel)
    const stripIdx = Math.floor((z0 * 20 + roadOffset * 20)) % 2;
    ctx.fillStyle = stripIdx === 0 ? GRASS_LIGHT : GRASS_DARK;
    ctx.fillRect(0, y0, W, y1 - y0 + 1);

    // Road shoulder (red-white rumble strips)
    const shoulderW = rw0 * 0.07;
    const shoulderW1 = rw1 * 0.07;
    const shoulderColor = stripIdx === 0 ? SHOULDER_RED : SHOULDER_WHT;
    ctx.fillStyle = shoulderColor;
    // Left shoulder
    ctx.beginPath();
    ctx.moveTo(cx - rw0/2 - shoulderW, y0);
    ctx.lineTo(cx - rw1/2 - shoulderW1, y1);
    ctx.lineTo(cx - rw1/2, y1);
    ctx.lineTo(cx - rw0/2, y0);
    ctx.fill();
    // Right shoulder
    ctx.beginPath();
    ctx.moveTo(cx + rw0/2, y0);
    ctx.lineTo(cx + rw1/2, y1);
    ctx.lineTo(cx + rw1/2 + shoulderW1, y1);
    ctx.lineTo(cx + rw0/2 + shoulderW, y0);
    ctx.fill();

    // Road surface
    ctx.fillStyle = ROAD_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx - rw0/2, y0);
    ctx.lineTo(cx - rw1/2, y1);
    ctx.lineTo(cx + rw1/2, y1);
    ctx.lineTo(cx + rw0/2, y0);
    ctx.fill();

    // Yellow edge lines
    const edgeLineW = Math.max(1, 2 * scale * z0);
    ctx.fillStyle = ROAD_EDGE;
    ctx.fillRect(cx - rw0/2, y0, edgeLineW, y1 - y0 + 1);
    ctx.fillRect(cx + rw0/2 - edgeLineW, y0, edgeLineW, y1 - y0 + 1);

    // Lane dashes
    if (stripIdx === 0 && z0 > 0.02) {
      ctx.fillStyle = STRIPE_WHITE;
      const dashW = Math.max(1, 1.5 * scale * z0);
      for (let lane = 1; lane < LANE_COUNT; lane++) {
        const lx0 = cx - rw0/2 + (rw0 / LANE_COUNT) * lane;
        ctx.fillRect(lx0 - dashW/2, y0, dashW, y1 - y0 + 1);
      }
    }
  }
}

// ── Trees ──
function drawTrees() {
  const hY = HORIZON_Y * H;
  const roadH = H - hY;

  for (const t of treePositions) {
    const z = ((t.z + roadOffset * 0.3) % 1);
    if (z < 0.05) continue;
    const y = hY + z * roadH;
    const roadW = lerp(ROAD_W_TOP * W, ROAD_W_BOTTOM * W, z);
    const treeX = W / 2 + t.side * (roadW / 2 + roadW * 0.15 + z * 30 * scale);
    const treeH = t.size * 40 * scale * z;
    const trunkW = Math.max(2, 3 * scale * z);

    // Trunk
    ctx.fillStyle = "#3d2817";
    ctx.fillRect(treeX - trunkW/2, y - treeH, trunkW, treeH * 0.4);

    // Canopy
    ctx.fillStyle = `hsl(${t.hue}, 50%, ${(15 + z * 10) * TREE_L_MULT}%)`;
    ctx.beginPath();
    ctx.arc(treeX, y - treeH * 0.75, treeH * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Obstacles ──
function drawObstacles() {
  // Sort by z so far objects draw first
  const sorted = [...obstacles].sort((a, b) => a.z - b.z);

  for (const obs of sorted) {
    if (obs.z < 0.02 || obs.z > 1.1) continue;

    const x = laneToX(obs.lane, obs.z);
    const y = HORIZON_Y * H + obs.z * (H - HORIZON_Y * H);
    const s = obs.z; // scale factor
    const bw = obs.wFrac * W * s;
    const bh = obs.hFrac * H * s;

    if (obs.type === OBS_CAR || obs.type === OBS_TRUCK) {
      drawVehicle(x, y, bw, bh, obs.color, obs.type === OBS_TRUCK);
    } else if (obs.type === OBS_BARREL) {
      drawBarrel(x, y, bw, bh);
    } else {
      drawCone(x, y, bw, bh);
    }
  }
}

function drawVehicle(x, y, w, h, color, isTruck) {
  // === Ground Shadow ===
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 2*scale, y + 2*scale, w*0.52, h*0.12, 0, 0, Math.PI*2);
  ctx.fill();

  if (isTruck) {
    // ── TRUCK DRAWING ──
    const cabH = h * 0.38;
    const cargoH = h * 0.58;
    const cargoY = y - h;
    const cabY = cargoY + cargoH * 0.05;

    // Wheels (rear axle, visible under body)
    ctx.fillStyle = "#1a1a1a";
    const wheelR = Math.max(2, w * 0.1);
    ctx.beginPath();
    ctx.arc(x - w*0.38, y - h*0.04, wheelR, 0, Math.PI*2);
    ctx.arc(x + w*0.38, y - h*0.04, wheelR, 0, Math.PI*2);
    ctx.fill();
    // Wheel rims
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(x - w*0.38, y - h*0.04, wheelR*0.5, 0, Math.PI*2);
    ctx.arc(x + w*0.38, y - h*0.04, wheelR*0.5, 0, Math.PI*2);
    ctx.fill();

    // Cargo bed body
    const cargoGrad = ctx.createLinearGradient(x - w/2, cargoY, x + w/2, cargoY);
    cargoGrad.addColorStop(0, darkenColor(color, 30));
    cargoGrad.addColorStop(0.3, color);
    cargoGrad.addColorStop(0.7, lightenColor(color, 15));
    cargoGrad.addColorStop(1, darkenColor(color, 40));
    ctx.fillStyle = cargoGrad;
    roundRect(x - w*0.48, cargoY, w*0.96, cargoH, Math.max(2, 3*scale));

    // Cargo cover / tarp with vertical slats
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    const slatCount = 4;
    for (let s = 0; s < slatCount; s++) {
      const sx = x - w*0.45 + (w*0.9 / slatCount) * s;
      ctx.fillRect(sx, cargoY + 2*scale, Math.max(1, 1.5*scale), cargoH - 4*scale);
    }

    // Cab
    const cabGrad = ctx.createLinearGradient(x, cabY, x, cabY + cabH);
    cabGrad.addColorStop(0, lightenColor(color, 40));
    cabGrad.addColorStop(0.5, color);
    cabGrad.addColorStop(1, darkenColor(color, 30));
    ctx.fillStyle = cabGrad;
    roundRect(x - w*0.42, cabY, w*0.84, cabH, Math.max(2, 4*scale));

    // Cab windshield
    const cwsGrad = ctx.createLinearGradient(x, cabY + cabH*0.1, x, cabY + cabH*0.55);
    cwsGrad.addColorStop(0, "rgba(140,200,255,0.8)");
    cwsGrad.addColorStop(1, "rgba(80,140,200,0.5)");
    ctx.fillStyle = cwsGrad;
    roundRect(x - w*0.32, cabY + cabH*0.12, w*0.64, cabH*0.45, Math.max(1, 2*scale));

    // Windshield glare line
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x - w*0.1, cabY + cabH*0.15, w*0.03, cabH*0.35);

    // Taillights (wide, rectangular for truck)
    ctx.fillStyle = "#ff2200";
    roundRect(x - w*0.45, y - h*0.13, w*0.15, h*0.07, 1);
    roundRect(x + w*0.30, y - h*0.13, w*0.15, h*0.07, 1);

    // Taillight glow
    ctx.fillStyle = "rgba(255,30,0,0.18)";
    ctx.beginPath();
    ctx.arc(x - w*0.38, y - h*0.10, w*0.12, 0, Math.PI*2);
    ctx.arc(x + w*0.38, y - h*0.10, w*0.12, 0, Math.PI*2);
    ctx.fill();

    // Bumper
    ctx.fillStyle = "rgba(80,80,80,0.7)";
    roundRect(x - w*0.46, y - h*0.06, w*0.92, h*0.05, 1);

  } else {
    // ── CAR DRAWING ──

    // Wheels (visible as semicircles at bottom edges)
    ctx.fillStyle = "#111";
    const wheelR = Math.max(2, w * 0.09);
    // Rear wheels
    ctx.beginPath();
    ctx.arc(x - w*0.35, y - h*0.04, wheelR, 0, Math.PI*2);
    ctx.arc(x + w*0.35, y - h*0.04, wheelR, 0, Math.PI*2);
    ctx.fill();
    // Front wheels
    ctx.beginPath();
    ctx.arc(x - w*0.32, y - h*0.82, wheelR*0.85, 0, Math.PI*2);
    ctx.arc(x + w*0.32, y - h*0.82, wheelR*0.85, 0, Math.PI*2);
    ctx.fill();
    // Wheel rims
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(x - w*0.35, y - h*0.04, wheelR*0.45, 0, Math.PI*2);
    ctx.arc(x + w*0.35, y - h*0.04, wheelR*0.45, 0, Math.PI*2);
    ctx.arc(x - w*0.32, y - h*0.82, wheelR*0.4, 0, Math.PI*2);
    ctx.arc(x + w*0.32, y - h*0.82, wheelR*0.4, 0, Math.PI*2);
    ctx.fill();

    // Main body (with gradient for 3D feel)
    const bodyGrad = ctx.createLinearGradient(x - w/2, y - h, x + w/2, y);
    bodyGrad.addColorStop(0, lightenColor(color, 45));
    bodyGrad.addColorStop(0.25, lightenColor(color, 20));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(0.85, darkenColor(color, 35));
    bodyGrad.addColorStop(1, darkenColor(color, 55));
    ctx.fillStyle = bodyGrad;
    // Shaped body path instead of rectangle
    ctx.beginPath();
    const r = Math.max(2, 5 * w/50);
    ctx.moveTo(x - w*0.38, y);
    ctx.lineTo(x - w*0.48, y - h*0.15);
    ctx.lineTo(x - w*0.48, y - h*0.75);
    ctx.quadraticCurveTo(x - w*0.48, y - h, x - w*0.35, y - h);
    ctx.lineTo(x + w*0.35, y - h);
    ctx.quadraticCurveTo(x + w*0.48, y - h, x + w*0.48, y - h*0.75);
    ctx.lineTo(x + w*0.48, y - h*0.15);
    ctx.lineTo(x + w*0.38, y);
    ctx.closePath();
    ctx.fill();

    // Roof/cabin (raised section)
    const roofGrad = ctx.createLinearGradient(x, y - h*0.9, x, y - h*0.4);
    roofGrad.addColorStop(0, lightenColor(color, 15));
    roofGrad.addColorStop(1, darkenColor(color, 10));
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(x - w*0.35, y - h*0.42);
    ctx.quadraticCurveTo(x - w*0.38, y - h*0.72, x - w*0.30, y - h*0.78);
    ctx.lineTo(x + w*0.30, y - h*0.78);
    ctx.quadraticCurveTo(x + w*0.38, y - h*0.72, x + w*0.35, y - h*0.42);
    ctx.closePath();
    ctx.fill();

    // Body side highlight (reflective strip)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x - w*0.46, y - h*0.55, w*0.92, h*0.04);

    // Rear windshield
    const rwsGrad = ctx.createLinearGradient(x, y - h*0.42, x, y - h*0.52);
    rwsGrad.addColorStop(0, "rgba(60,100,150,0.5)");
    rwsGrad.addColorStop(1, "rgba(100,170,240,0.7)");
    ctx.fillStyle = rwsGrad;
    roundRect(x - w*0.28, y - h*0.52, w*0.56, h*0.12, Math.max(1, 2*scale));

    // Front windshield
    const wsGrad = ctx.createLinearGradient(x, y - h*0.92, x, y - h*0.72);
    wsGrad.addColorStop(0, "rgba(140,210,255,0.85)");
    wsGrad.addColorStop(0.5, "rgba(100,180,240,0.7)");
    wsGrad.addColorStop(1, "rgba(70,130,200,0.5)");
    ctx.fillStyle = wsGrad;
    roundRect(x - w*0.30, y - h*0.92, w*0.60, h*0.22, Math.max(1, 3*scale));

    // Windshield glare
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(x - w*0.08, y - h*0.90);
    ctx.lineTo(x - w*0.03, y - h*0.90);
    ctx.lineTo(x - w*0.12, y - h*0.74);
    ctx.lineTo(x - w*0.17, y - h*0.74);
    ctx.closePath();
    ctx.fill();

    // Side mirrors
    ctx.fillStyle = darkenColor(color, 20);
    ctx.fillRect(x - w*0.54, y - h*0.65, w*0.08, h*0.06);
    ctx.fillRect(x + w*0.46, y - h*0.65, w*0.08, h*0.06);

    // Taillights
    ctx.fillStyle = "#ff1100";
    const tlR = Math.max(1.5, w*0.07);
    roundRect(x - w*0.42, y - h*0.12, w*0.14, h*0.06, tlR*0.3);
    roundRect(x + w*0.28, y - h*0.12, w*0.14, h*0.06, tlR*0.3);
    // Taillight inner glow
    ctx.fillStyle = "#ff6644";
    roundRect(x - w*0.40, y - h*0.11, w*0.06, h*0.04, 1);
    roundRect(x + w*0.34, y - h*0.11, w*0.06, h*0.04, 1);

    // Taillight ambient glow
    ctx.fillStyle = "rgba(255,20,0,0.2)";
    ctx.beginPath();
    ctx.arc(x - w*0.35, y - h*0.09, w*0.12, 0, Math.PI*2);
    ctx.arc(x + w*0.35, y - h*0.09, w*0.12, 0, Math.PI*2);
    ctx.fill();

    // License plate area
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    roundRect(x - w*0.12, y - h*0.08, w*0.24, h*0.05, 1);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x - w*0.10, y - h*0.07, w*0.20, h*0.03);

    // Bumper
    ctx.fillStyle = "rgba(60,60,60,0.6)";
    roundRect(x - w*0.44, y - h*0.05, w*0.88, h*0.04, 2);
  }
  ctx.restore();
}

function drawBarrel(x, y, w, h) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x + 2*scale, y + 1*scale, w*0.55, h*0.18, 0, 0, Math.PI*2);
  ctx.fill();

  // Barrel body (cylinder representation)
  const barrelGrad = ctx.createLinearGradient(x - w/2, 0, x + w/2, 0);
  barrelGrad.addColorStop(0, "#994400");
  barrelGrad.addColorStop(0.2, "#dd7700");
  barrelGrad.addColorStop(0.5, "#ee8811");
  barrelGrad.addColorStop(0.8, "#cc6600");
  barrelGrad.addColorStop(1, "#884400");
  ctx.fillStyle = barrelGrad;
  roundRect(x - w*0.45, y - h*0.9, w*0.9, h*0.85, Math.max(2, w*0.1));

  // Metal bands
  ctx.fillStyle = "rgba(120,120,120,0.8)";
  ctx.fillRect(x - w*0.46, y - h*0.85, w*0.92, h*0.06);
  ctx.fillRect(x - w*0.46, y - h*0.55, w*0.92, h*0.06);
  ctx.fillRect(x - w*0.46, y - h*0.15, w*0.92, h*0.06);

  // Warning stripe (reflective orange + white)
  ctx.fillStyle = "#ffaa00";
  ctx.fillRect(x - w*0.44, y - h*0.73, w*0.88, h*0.15);
  // White diamonds on stripe
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  const dw = w * 0.12;
  for (let d = -2; d <= 2; d++) {
    const dx = x + d * w*0.18;
    ctx.beginPath();
    ctx.moveTo(dx, y - h*0.73);
    ctx.lineTo(dx + dw/2, y - h*0.655);
    ctx.lineTo(dx, y - h*0.58);
    ctx.lineTo(dx - dw/2, y - h*0.655);
    ctx.closePath();
    ctx.fill();
  }

  // Top ellipse (lid)
  const lidGrad = ctx.createRadialGradient(x - w*0.05, y - h*0.92, 0, x, y - h*0.88, w*0.5);
  lidGrad.addColorStop(0, "#dd8822");
  lidGrad.addColorStop(1, "#995511");
  ctx.fillStyle = lidGrad;
  ctx.beginPath();
  ctx.ellipse(x, y - h*0.88, w*0.44, h*0.1, 0, 0, Math.PI*2);
  ctx.fill();

  // Lid highlight
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.ellipse(x - w*0.1, y - h*0.92, w*0.15, h*0.04, -0.3, 0, Math.PI*2);
  ctx.fill();
}

function drawCone(x, y, w, h) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 1*scale, y + 1*scale, w*0.6, h*0.15, 0, 0, Math.PI*2);
  ctx.fill();

  // Base plate (square-ish)
  ctx.fillStyle = "#333";
  roundRect(x - w*0.55, y - h*0.08, w*1.1, h*0.1, 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(x - w*0.55, y - h*0.08, w*1.1, h*0.03, 1);

  // Cone body with gradient
  const coneGrad = ctx.createLinearGradient(x - w/2, 0, x + w/2, 0);
  coneGrad.addColorStop(0, "#cc4400");
  coneGrad.addColorStop(0.3, "#ff6600");
  coneGrad.addColorStop(0.6, "#ff8833");
  coneGrad.addColorStop(1, "#cc4400");
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x - w*0.08, y - h*0.5, x - w*0.45, y - h*0.05);
  ctx.lineTo(x + w*0.45, y - h*0.05);
  ctx.quadraticCurveTo(x + w*0.08, y - h*0.5, x, y - h);
  ctx.closePath();
  ctx.fill();

  // Upper reflective white band
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  const b1Top = 0.68, b1Bot = 0.52;
  const t1 = 1 - b1Top, t2 = 1 - b1Bot;
  ctx.moveTo(x - w*(0.08 + t1*0.37), y - h*b1Top);
  ctx.lineTo(x + w*(0.08 + t1*0.37), y - h*b1Top);
  ctx.lineTo(x + w*(0.08 + t2*0.37), y - h*b1Bot);
  ctx.lineTo(x - w*(0.08 + t2*0.37), y - h*b1Bot);
  ctx.closePath();
  ctx.fill();

  // Lower reflective white band
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  const b2Top = 0.38, b2Bot = 0.22;
  const t3 = 1 - b2Top, t4 = 1 - b2Bot;
  ctx.moveTo(x - w*(0.08 + t3*0.37), y - h*b2Top);
  ctx.lineTo(x + w*(0.08 + t3*0.37), y - h*b2Top);
  ctx.lineTo(x + w*(0.08 + t4*0.37), y - h*b2Bot);
  ctx.lineTo(x - w*(0.08 + t4*0.37), y - h*b2Bot);
  ctx.closePath();
  ctx.fill();

  // Cone tip highlight
  ctx.fillStyle = "rgba(255,200,100,0.5)";
  ctx.beginPath();
  ctx.arc(x, y - h*0.97, Math.max(1, w*0.06), 0, Math.PI*2);
  ctx.fill();

  // Side highlight (glossy)
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(x - w*0.05, y - h*0.95);
  ctx.quadraticCurveTo(x - w*0.02, y - h*0.5, x - w*0.18, y - h*0.08);
  ctx.lineTo(x - w*0.08, y - h*0.08);
  ctx.quadraticCurveTo(x - w*0.04, y - h*0.5, x - w*0.02, y - h*0.95);
  ctx.closePath();
  ctx.fill();
}

// ── Player Car (Sports Car) ──
function drawPlayer() {
  const z = 0.88;
  const x = laneToX(playerLaneSmooth, z);
  const y = HORIZON_Y * H + z * (H - HORIZON_Y * H);
  const carW = 0.14 * W * z;
  const carH = 0.09 * H * z;

  // === Ground Shadow ===
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(x + 2*scale, y + 4*scale, carW*0.55, carH*0.12, 0, 0, Math.PI*2);
  ctx.fill();

  // === Wheels ===
  ctx.fillStyle = "#0a0a0a";
  const wR = Math.max(3, carW * 0.095);
  // Rear wheels
  ctx.beginPath();
  ctx.arc(x - carW*0.38, y - carH*0.03, wR, 0, Math.PI*2);
  ctx.arc(x + carW*0.38, y - carH*0.03, wR, 0, Math.PI*2);
  ctx.fill();
  // Front wheels
  ctx.beginPath();
  ctx.arc(x - carW*0.33, y - carH*0.85, wR*0.9, 0, Math.PI*2);
  ctx.arc(x + carW*0.33, y - carH*0.85, wR*0.9, 0, Math.PI*2);
  ctx.fill();
  // Rims (gold alloy)
  ctx.fillStyle = "#ccaa44";
  ctx.beginPath();
  ctx.arc(x - carW*0.38, y - carH*0.03, wR*0.5, 0, Math.PI*2);
  ctx.arc(x + carW*0.38, y - carH*0.03, wR*0.5, 0, Math.PI*2);
  ctx.arc(x - carW*0.33, y - carH*0.85, wR*0.45, 0, Math.PI*2);
  ctx.arc(x + carW*0.33, y - carH*0.85, wR*0.45, 0, Math.PI*2);
  ctx.fill();

  // === Main Body (aerodynamic shape) ===
  const bodyGrad = ctx.createLinearGradient(x - carW/2, y - carH, x + carW/2, y);
  bodyGrad.addColorStop(0, "#ff6655");
  bodyGrad.addColorStop(0.15, "#ee2222");
  bodyGrad.addColorStop(0.5, "#cc0000");
  bodyGrad.addColorStop(0.85, "#990000");
  bodyGrad.addColorStop(1, "#660000");
  ctx.fillStyle = bodyGrad;

  // Sports car shaped body path
  ctx.beginPath();
  ctx.moveTo(x - carW*0.32, y);       // bottom-left
  ctx.lineTo(x - carW*0.48, y - carH*0.10);
  ctx.lineTo(x - carW*0.50, y - carH*0.25);
  ctx.lineTo(x - carW*0.48, y - carH*0.70);
  ctx.quadraticCurveTo(x - carW*0.46, y - carH*0.98, x - carW*0.30, y - carH);
  ctx.lineTo(x + carW*0.30, y - carH);
  ctx.quadraticCurveTo(x + carW*0.46, y - carH*0.98, x + carW*0.48, y - carH*0.70);
  ctx.lineTo(x + carW*0.50, y - carH*0.25);
  ctx.lineTo(x + carW*0.48, y - carH*0.10);
  ctx.lineTo(x + carW*0.32, y);       // bottom-right
  ctx.closePath();
  ctx.fill();

  // === Hood (front section) ===
  const hoodGrad = ctx.createLinearGradient(x, y - carH, x, y - carH*0.7);
  hoodGrad.addColorStop(0, "rgba(255,100,80,0.4)");
  hoodGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hoodGrad;
  ctx.beginPath();
  ctx.moveTo(x - carW*0.30, y - carH);
  ctx.lineTo(x + carW*0.30, y - carH);
  ctx.lineTo(x + carW*0.44, y - carH*0.72);
  ctx.lineTo(x - carW*0.44, y - carH*0.72);
  ctx.closePath();
  ctx.fill();

  // Hood center line
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = Math.max(1, 1.5*scale);
  ctx.beginPath();
  ctx.moveTo(x, y - carH*0.98);
  ctx.lineTo(x, y - carH*0.72);
  ctx.stroke();

  // === Cabin / Roof ===
  const roofGrad = ctx.createLinearGradient(x, y - carH*0.72, x, y - carH*0.38);
  roofGrad.addColorStop(0, "#bb0000");
  roofGrad.addColorStop(1, "#880000");
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(x - carW*0.36, y - carH*0.38);
  ctx.quadraticCurveTo(x - carW*0.38, y - carH*0.62, x - carW*0.30, y - carH*0.70);
  ctx.lineTo(x + carW*0.30, y - carH*0.70);
  ctx.quadraticCurveTo(x + carW*0.38, y - carH*0.62, x + carW*0.36, y - carH*0.38);
  ctx.closePath();
  ctx.fill();

  // === Windshield (front) ===
  const wsGrad = ctx.createLinearGradient(x, y - carH*0.72, x, y - carH*0.58);
  wsGrad.addColorStop(0, "rgba(100,200,255,0.85)");
  wsGrad.addColorStop(0.5, "rgba(70,160,230,0.7)");
  wsGrad.addColorStop(1, "rgba(40,100,180,0.6)");
  ctx.fillStyle = wsGrad;
  ctx.beginPath();
  ctx.moveTo(x - carW*0.28, y - carH*0.68);
  ctx.lineTo(x + carW*0.28, y - carH*0.68);
  ctx.lineTo(x + carW*0.34, y - carH*0.56);
  ctx.lineTo(x - carW*0.34, y - carH*0.56);
  ctx.closePath();
  ctx.fill();

  // Windshield glare
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(x - carW*0.12, y - carH*0.67);
  ctx.lineTo(x - carW*0.06, y - carH*0.67);
  ctx.lineTo(x - carW*0.16, y - carH*0.57);
  ctx.lineTo(x - carW*0.22, y - carH*0.57);
  ctx.closePath();
  ctx.fill();

  // === Rear windshield ===
  const rwsGrad = ctx.createLinearGradient(x, y - carH*0.50, x, y - carH*0.38);
  rwsGrad.addColorStop(0, "rgba(90,160,220,0.7)");
  rwsGrad.addColorStop(1, "rgba(50,100,160,0.5)");
  ctx.fillStyle = rwsGrad;
  ctx.beginPath();
  ctx.moveTo(x - carW*0.30, y - carH*0.48);
  ctx.lineTo(x + carW*0.30, y - carH*0.48);
  ctx.lineTo(x + carW*0.34, y - carH*0.40);
  ctx.lineTo(x - carW*0.34, y - carH*0.40);
  ctx.closePath();
  ctx.fill();

  // === Racing Stripes (dual) ===
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  const sW = carW * 0.06;
  const sGap = carW * 0.04;
  ctx.fillRect(x - sGap - sW, y - carH*0.98, sW, carH*0.56);
  ctx.fillRect(x + sGap, y - carH*0.98, sW, carH*0.56);
  // Stripes continue on rear
  ctx.fillRect(x - sGap - sW, y - carH*0.37, sW, carH*0.30);
  ctx.fillRect(x + sGap, y - carH*0.37, sW, carH*0.30);

  // === Body reflective highlight ===
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(x - carW*0.48, y - carH*0.55, carW*0.96, carH*0.03);

  // === Side mirrors ===
  ctx.fillStyle = "#aa0000";
  ctx.fillRect(x - carW*0.56, y - carH*0.62, carW*0.09, carH*0.05);
  ctx.fillRect(x + carW*0.47, y - carH*0.62, carW*0.09, carH*0.05);
  // Mirror glass
  ctx.fillStyle = "rgba(100,180,255,0.6)";
  ctx.fillRect(x - carW*0.55, y - carH*0.615, carW*0.06, carH*0.035);
  ctx.fillRect(x + carW*0.49, y - carH*0.615, carW*0.06, carH*0.035);

  // === Side air intakes ===
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  roundRect(x - carW*0.48, y - carH*0.48, carW*0.10, carH*0.06, 1);
  roundRect(x + carW*0.38, y - carH*0.48, carW*0.10, carH*0.06, 1);

  // === Rear Spoiler ===
  ctx.fillStyle = "#440000";
  ctx.fillRect(x - carW*0.38, y - carH*0.35, carW*0.76, carH*0.025);
  // Spoiler supports
  ctx.fillRect(x - carW*0.34, y - carH*0.37, carW*0.03, carH*0.04);
  ctx.fillRect(x + carW*0.31, y - carH*0.37, carW*0.03, carH*0.04);

  // === Headlights (at front/top of car) ===
  ctx.fillStyle = "#ffffdd";
  const hlR = Math.max(2, carW * 0.06);
  ctx.beginPath();
  ctx.arc(x - carW*0.28, y - carH*0.96, hlR, 0, Math.PI*2);
  ctx.arc(x + carW*0.28, y - carH*0.96, hlR, 0, Math.PI*2);
  ctx.fill();
  // LED headlight detail
  ctx.fillStyle = "rgba(200,240,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - carW*0.28, y - carH*0.96, hlR*0.6, 0, Math.PI*2);
  ctx.arc(x + carW*0.28, y - carH*0.96, hlR*0.6, 0, Math.PI*2);
  ctx.fill();

  // === Headlight beams (projected forward) ===
  ctx.fillStyle = "rgba(255,255,220,0.05)";
  ctx.beginPath();
  ctx.moveTo(x - carW*0.40, y - carH);
  ctx.lineTo(x - carW*0.60, y - carH - carH*2.5);
  ctx.lineTo(x + carW*0.60, y - carH - carH*2.5);
  ctx.lineTo(x + carW*0.40, y - carH);
  ctx.fill();
  // Inner bright beam
  ctx.fillStyle = "rgba(255,255,230,0.04)";
  ctx.beginPath();
  ctx.moveTo(x - carW*0.25, y - carH);
  ctx.lineTo(x - carW*0.35, y - carH - carH*3);
  ctx.lineTo(x + carW*0.35, y - carH - carH*3);
  ctx.lineTo(x + carW*0.25, y - carH);
  ctx.fill();

  // === Taillights ===
  ctx.fillStyle = "#ff1100";
  roundRect(x - carW*0.44, y - carH*0.12, carW*0.16, carH*0.05, 2);
  roundRect(x + carW*0.28, y - carH*0.12, carW*0.16, carH*0.05, 2);
  // Inner taillight glow
  ctx.fillStyle = "#ff5533";
  roundRect(x - carW*0.42, y - carH*0.115, carW*0.06, carH*0.04, 1);
  roundRect(x + carW*0.36, y - carH*0.115, carW*0.06, carH*0.04, 1);
  // Ambient glow
  ctx.fillStyle = "rgba(255,30,0,0.15)";
  ctx.beginPath();
  ctx.arc(x - carW*0.36, y - carH*0.09, carW*0.14, 0, Math.PI*2);
  ctx.arc(x + carW*0.36, y - carH*0.09, carW*0.14, 0, Math.PI*2);
  ctx.fill();

  // === Exhaust Pipes ===
  ctx.fillStyle = "#555";
  const exR = Math.max(1.5, carW*0.025);
  ctx.beginPath();
  ctx.arc(x - carW*0.18, y + exR*0.5, exR, 0, Math.PI*2);
  ctx.arc(x + carW*0.18, y + exR*0.5, exR, 0, Math.PI*2);
  ctx.fill();
  // Exhaust inner (dark)
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(x - carW*0.18, y + exR*0.5, exR*0.6, 0, Math.PI*2);
  ctx.arc(x + carW*0.18, y + exR*0.5, exR*0.6, 0, Math.PI*2);
  ctx.fill();

  // === Rear bumper ===
  ctx.fillStyle = "rgba(50,50,50,0.6)";
  roundRect(x - carW*0.42, y - carH*0.04, carW*0.84, carH*0.035, 2);

  // === Front bumper / splitter ===
  ctx.fillStyle = "rgba(30,30,30,0.7)";
  roundRect(x - carW*0.38, y - carH*1.02, carW*0.76, carH*0.03, 2);

  // === Speed Effects ===
  if (speed > BASE_SPEED * 1.3) {
    const intensity = (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);

    // Speed lines (longer and more numerous at higher speed)
    ctx.strokeStyle = `rgba(255,255,255,${intensity * 0.25})`;
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    const lineCount = Math.floor(3 + intensity * 6);
    for (let i = 0; i < lineCount; i++) {
      const lx = x + (Math.random()-0.5) * carW * 2;
      const ly = y + Math.random() * carH * 0.3;
      const len = (8 + intensity * 28) * scale;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + len);
      ctx.stroke();
    }

    // Side wind streaks
    ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.12})`;
    ctx.lineWidth = Math.max(0.5, 0.8*scale);
    for (let i = 0; i < 3; i++) {
      const sx = x + (Math.random() > 0.5 ? 1 : -1) * (carW*0.5 + Math.random()*carW*0.4);
      const sy = y - carH*0.3 - Math.random()*carH*0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + (12 + intensity*18)*scale);
      ctx.stroke();
    }

    // Exhaust flame at very high speed
    if (intensity > 0.5) {
      const flameAlpha = (intensity - 0.5) * 0.6;
      ctx.fillStyle = `rgba(255,100,20,${flameAlpha})`;
      ctx.beginPath();
      ctx.moveTo(x - carW*0.18, y + exR);
      ctx.lineTo(x - carW*0.20, y + exR + (4 + intensity*8)*scale);
      ctx.lineTo(x - carW*0.16, y + exR + (4 + intensity*8)*scale);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + carW*0.18, y + exR);
      ctx.lineTo(x + carW*0.16, y + exR + (4 + intensity*8)*scale);
      ctx.lineTo(x + carW*0.20, y + exR + (4 + intensity*8)*scale);
      ctx.closePath();
      ctx.fill();
      // Inner flame (brighter)
      ctx.fillStyle = `rgba(255,200,50,${flameAlpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(x - carW*0.18, y + exR + 2*scale, exR*0.4, 0, Math.PI*2);
      ctx.arc(x + carW*0.18, y + exR + 2*scale, exR*0.4, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

// ── Particles ──
function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * scale * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── HUD ──
function drawHUD() {
  if (state === "MENU") return;

  const pad = 12 * scale;
  const fontSize = Math.max(14, 18 * scale);
  const smFont = Math.max(11, 13 * scale);

  // Top bar background
  const barH = 56 * scale;
  const barGrad = ctx.createLinearGradient(0, 0, 0, barH);
  barGrad.addColorStop(0, "rgba(0,0,0,0.7)");
  barGrad.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, barH);

  // Bottom line accent
  ctx.fillStyle = "rgba(255,200,0,0.5)";
  ctx.fillRect(0, barH - 2*scale, W, 2*scale);

  // Score
  ctx.fillStyle = "#ffcc00";
  ctx.font = `900 ${fontSize * 1.2}px Orbitron, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${score}`, W/2, pad + fontSize);

  // Speed + Distance
  ctx.font = `600 ${smFont}px Orbitron, monospace`;
  ctx.fillStyle = "#aaaaaa";
  ctx.textAlign = "left";
  ctx.fillText(`${Math.floor(speed * 12)} km/h`, pad, pad + smFont);
  ctx.fillText(`${Math.floor(distance)}m`, pad, pad + smFont * 2.3);

  // High Score
  ctx.textAlign = "right";
  ctx.fillStyle = "#888";
  ctx.fillText(`HI ${highScore}`, W - pad, pad + smFont);

  // Combo multiplier
  if (comboMultiplier > 1.1) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff6600";
    ctx.font = `700 ${smFont * 1.1}px Orbitron, monospace`;
    ctx.fillText(`x${comboMultiplier.toFixed(1)}`, W - pad, pad + smFont * 2.3);
  }

  // Near miss flash
  if (nearMissFlash > 0) {
    ctx.save();
    ctx.globalAlpha = nearMissFlash;
    ctx.fillStyle = "#00ff88";
    ctx.font = `900 ${fontSize * 1.5}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("NEAR MISS!", W/2, H * 0.55);
    ctx.restore();
  }

  // Speed bar (bottom)
  if (state === "PLAYING") {
    const barW = W * 0.4;
    const barBH = 8 * scale;
    const barX = W/2 - barW/2;
    const barY = H - 30 * scale;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(barX, barY, barW, barBH, 4*scale);
    const fill = (speed - BASE_SPEED*0.5) / (MAX_SPEED - BASE_SPEED*0.5);
    const speedGrad = ctx.createLinearGradient(barX, 0, barX + barW * fill, 0);
    speedGrad.addColorStop(0, "#00cc44");
    speedGrad.addColorStop(0.7, "#ffcc00");
    speedGrad.addColorStop(1, "#ff3300");
    ctx.fillStyle = speedGrad;
    roundRect(barX, barY, barW * clamp(fill, 0, 1), barBH, 4*scale);
  }
}

// ── Touch Zone Indicators ──
function drawTouchZones() {
  ctx.globalAlpha = 0.06;
  // Left zone
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, H * 0.15, W * 0.40, H * 0.70);
  // Right zone
  ctx.fillRect(W * 0.60, H * 0.15, W * 0.40, H * 0.70);
  ctx.globalAlpha = 1;

  // Arrow hints
  const arrowSize = 30 * scale;
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffff";
  // Left arrow
  ctx.beginPath();
  ctx.moveTo(W * 0.15, H * 0.5);
  ctx.lineTo(W * 0.15 + arrowSize, H * 0.5 - arrowSize);
  ctx.lineTo(W * 0.15 + arrowSize, H * 0.5 + arrowSize);
  ctx.fill();
  // Right arrow
  ctx.beginPath();
  ctx.moveTo(W * 0.85, H * 0.5);
  ctx.lineTo(W * 0.85 - arrowSize, H * 0.5 - arrowSize);
  ctx.lineTo(W * 0.85 - arrowSize, H * 0.5 + arrowSize);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Menu Overlay ──
function drawMenuOverlay() {
  // Dim
  ctx.fillStyle = "rgba(5,5,20,0.6)";
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00";
  ctx.font = `900 ${Math.max(28, 52 * scale)}px Orbitron, monospace`;
  ctx.fillText("STREET RUSH", W/2, H * 0.30);

  // Subtitle
  ctx.fillStyle = "#aaa";
  ctx.font = `600 ${Math.max(12, 16 * scale)}px Orbitron, monospace`;
  ctx.fillText("ENDLESS RACER", W/2, H * 0.36);

  // Instructions
  ctx.fillStyle = "#888";
  ctx.font = `400 ${Math.max(11, 14 * scale)}px Inter, sans-serif`;
  const isMobile = "ontouchstart" in window;
  if (isMobile) {
    ctx.fillText("Tap left / right side to switch lanes", W/2, H * 0.50);
    ctx.fillText("Tap center / top to accelerate", W/2, H * 0.55);
  } else {
    ctx.fillText("← → Arrow keys to switch lanes", W/2, H * 0.50);
    ctx.fillText("↑ Accelerate   ↓ Brake", W/2, H * 0.55);
  }

  // Start prompt
  const pulse = 0.7 + 0.3 * Math.sin(gameTime * 4 || Date.now() * 0.004);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#ffcc00";
  ctx.font = `700 ${Math.max(14, 20 * scale)}px Orbitron, monospace`;
  ctx.fillText(isMobile ? "TAP TO START" : "CLICK OR PRESS ENTER TO START", W/2, H * 0.68);
  ctx.globalAlpha = 1;

  // High score
  if (highScore > 0) {
    ctx.fillStyle = "#666";
    ctx.font = `600 ${Math.max(11, 14 * scale)}px Orbitron, monospace`;
    ctx.fillText(`HIGH SCORE: ${highScore}`, W/2, H * 0.78);
  }

  // Animate road in background
  roadOffset += 0.002;
  gameTime = (gameTime || 0) + 0.016;
}

// ── Game Over Overlay ──
function drawGameOverOverlay() {
  ctx.fillStyle = "rgba(10,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // GAME OVER text with glow
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = "#ff3333";
  ctx.font = `900 ${Math.max(28, 48 * scale)}px Orbitron, monospace`;
  ctx.fillText("GAME OVER", W/2, H * 0.32);
  ctx.shadowBlur = 0;

  // Score
  ctx.fillStyle = "#ffcc00";
  ctx.font = `700 ${Math.max(20, 34 * scale)}px Orbitron, monospace`;
  ctx.fillText(`${score}`, W/2, H * 0.44);

  ctx.fillStyle = "#999";
  ctx.font = `400 ${Math.max(11, 14 * scale)}px Inter, sans-serif`;
  ctx.fillText(`Distance: ${Math.floor(distance)}m`, W/2, H * 0.51);
  ctx.fillText(`Top Speed: ${Math.floor(MAX_SPEED * 12)} km/h`, W/2, H * 0.56);

  // New high score
  if (score >= highScore && score > 0) {
    ctx.fillStyle = "#00ff88";
    ctx.font = `700 ${Math.max(13, 17 * scale)}px Orbitron, monospace`;
    ctx.fillText("★ NEW HIGH SCORE ★", W/2, H * 0.63);
  }

  // Restart prompt
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#ffcc00";
  ctx.font = `700 ${Math.max(13, 18 * scale)}px Orbitron, monospace`;
  const isMobile = "ontouchstart" in window;
  ctx.fillText(isMobile ? "TAP TO RETRY" : "CLICK OR PRESS ENTER", W/2, H * 0.73);
  ctx.globalAlpha = 1;
}

// ── Utility Drawing ──
function roundRect(x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function lightenColor(hex, pct) {
  let r = parseInt(hex.slice(1,3), 16);
  let g = parseInt(hex.slice(3,5), 16);
  let b = parseInt(hex.slice(5,7), 16);
  r = Math.min(255, r + pct);
  g = Math.min(255, g + pct);
  b = Math.min(255, b + pct);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, pct) {
  let r = parseInt(hex.slice(1,3), 16);
  let g = parseInt(hex.slice(3,5), 16);
  let b = parseInt(hex.slice(5,7), 16);
  r = Math.max(0, r - pct);
  g = Math.max(0, g - pct);
  b = Math.max(0, b - pct);
  return `rgb(${r},${g},${b})`;
}

// ── Enter key to start ──
window.addEventListener("keydown", e => {
  if (e.code === "Enter" && (state === "MENU" || state === "GAME_OVER")) {
    startGame();
  }
});

// ── Game Loop ─────────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05); // cap dt
  lastTimestamp = timestamp;

  resize(); // handle dynamic resizing
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

lastTimestamp = performance.now();
requestAnimationFrame(gameLoop);

})();
