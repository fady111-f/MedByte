/* ══════════════════════════════════════════════
   SVD RAM Defender – Enhanced Application Logic
   MedByte OS Lab
══════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   1.  CANVAS REFERENCES
───────────────────────────────────────────── */
const matrixCanvas    = document.getElementById("matrixCanvas");
const matrixCtx       = matrixCanvas.getContext("2d");
const gameCanvas      = document.getElementById("gameCanvas");
const ctx             = gameCanvas.getContext("2d");
const originalCanvas  = document.getElementById("originalCanvas");
const origCtx         = originalCanvas.getContext("2d");
const compressedCanvas= document.getElementById("compressedCanvas");
const compCtx         = compressedCanvas.getContext("2d");

/* ─────────────────────────────────────────────
   2.  UI ELEMENT REFERENCES
───────────────────────────────────────────── */
const el = {
  gameStage:        document.getElementById("gameStage"),
  startOverlay:     document.getElementById("startOverlay"),
  gameOverOverlay:  document.getElementById("gameOverOverlay"),
  startButton:      document.getElementById("startButton"),
  restartButton:    document.getElementById("restartButton"),
  compressButton:   document.getElementById("compressButton"),
  rawButton:        document.getElementById("rawButton"),
  scoreValue:       document.getElementById("scoreValue"),
  comboValue:       document.getElementById("comboValue"),
  ramValue:         document.getElementById("ramValue"),
  ramFill:          document.getElementById("ramFill"),
  pressureValue:    document.getElementById("pressureValue"),
  statusText:       document.getElementById("statusText"),
  statusMessage:    document.getElementById("statusMessage"),
  finalScore:       document.getElementById("finalScore"),
  finalCombo:       document.getElementById("finalCombo"),
  comboPopup:       document.getElementById("comboPopup"),
  rankSlider:       document.getElementById("rankSlider"),
  rankValue:        document.getElementById("rankValue"),
  genStructured:    document.getElementById("genStructured"),
  genRandom:        document.getElementById("genRandom"),
  compressionRatio: document.getElementById("compressionRatio"),
  reconstructionError: document.getElementById("reconstructionError"),
  compressionDecision: document.getElementById("compressionDecision"),
  bestScore:        document.getElementById("bestScore"),
  bestCombo:        document.getElementById("bestCombo"),
  gamesPlayed:      document.getElementById("gamesPlayed"),
  correctDecisions: document.getElementById("correctDecisions"),
  hamburgerBtn:     document.getElementById("hamburgerBtn"),
  mobileMenu:       document.getElementById("mobileMenu"),
};

/* ─────────────────────────────────────────────
   3.  GAME CONSTANTS
───────────────────────────────────────────── */
const PAGE_SIZE        = 4096;
const STRUCTURED_SAVE  = Math.round(PAGE_SIZE * 0.75);
const RAW_RAM_COST     = 12;
const COMPRESSED_RAM_COST = 3;
const ERROR_RAM_PENALTY   = 24;
const PASSIVE_RAM_RATE    = 0.38;
const MAX_COMBO           = 8;

/* ─────────────────────────────────────────────
   4.  GAME STATE
───────────────────────────────────────────── */
const game = {
  state:       "idle",
  score:       0,
  ram:         0,
  pressure:    1,
  elapsed:     0,
  combo:       0,
  maxCombo:    0,
  activePage:  null,
  particles:   [],
  nextSpawnIn: 0,
  lastTime:    0,
  messageTimer: 0,
  correctCount: 0,
};

const session = {
  bestScore:    0,
  bestCombo:    0,
  gamesPlayed:  0,
  correctTotal: 0,
};

/* ─────────────────────────────────────────────
   5.  MATRIX RAIN BACKGROUND
───────────────────────────────────────────── */
const matrix = { columns: [], fontSize: 15, lastTime: 0 };

function resizeMatrixCanvas() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = matrixCanvas.getBoundingClientRect();
  matrixCanvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
  matrixCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  matrixCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  matrix.columns = Array.from(
    { length: Math.ceil(rect.width / matrix.fontSize) },
    () => Math.random() * -rect.height
  );
}

function drawMatrixRain(time) {
  const rect = matrixCanvas.getBoundingClientRect();
  const dt   = Math.min(32, time - matrix.lastTime || 16);
  matrix.lastTime = time;

  matrixCtx.fillStyle = "rgba(2, 6, 8, 0.12)";
  matrixCtx.fillRect(0, 0, rect.width, rect.height);
  matrixCtx.font = `${matrix.fontSize}px ui-monospace, 'JetBrains Mono', monospace`;

  for (let i = 0; i < matrix.columns.length; i++) {
    const x = i * matrix.fontSize;
    matrix.columns[i] += dt * (0.03 + (i % 7) * 0.003);
    if (matrix.columns[i] > rect.height + 80) matrix.columns[i] = -Math.random() * 260;

    for (let j = 0; j < 10; j++) {
      const y     = matrix.columns[i] - j * matrix.fontSize;
      const alpha = Math.max(0, 0.38 - j * 0.036);
      // Leading character bright
      if (j === 0) matrixCtx.fillStyle = `rgba(180, 248, 255, ${alpha + 0.15})`;
      else         matrixCtx.fillStyle = `rgba(62, 231, 255, ${alpha})`;
      const char = Math.random() > 0.5 ? "1" : "0";
      matrixCtx.fillText(char, x, y);
    }
  }
  requestAnimationFrame(drawMatrixRain);
}

/* ─────────────────────────────────────────────
   6.  GAME CANVAS RESIZE
───────────────────────────────────────────── */
function resizeGameCanvas() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = gameCanvas.getBoundingClientRect();
  gameCanvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
  gameCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ─────────────────────────────────────────────
   7.  GAME LOGIC
───────────────────────────────────────────── */
function resetGame() {
  game.state       = "running";
  game.score       = 0;
  game.ram         = 10;
  game.pressure    = 1;
  game.elapsed     = 0;
  game.combo       = 0;
  game.maxCombo    = 0;
  game.activePage  = null;
  game.particles   = [];
  game.nextSpawnIn = 0.22;
  game.messageTimer = 0;
  game.correctCount = 0;

  el.startOverlay.classList.add("hidden");
  el.gameOverOverlay.classList.add("hidden");
  setStatus("Memory manager online. Classify incoming pages.", "idle");
  updateHud();
}

function setStatus(message, type = "idle") {
  el.statusText.textContent = message;
  el.statusMessage.querySelector(".status-dot").className = `status-dot ${type}`;
  game.messageTimer = 2.8;
}

function spawnPage() {
  const rect          = gameCanvas.getBoundingClientRect();
  const structuredBias = Math.max(0.38, 0.68 - game.elapsed * 0.0028);
  const type          = Math.random() < structuredBias ? "structured" : "random";
  const size          = Math.max(48, Math.min(80, rect.width * 0.11));

  game.activePage = {
    type,
    x:        rect.width / 2,
    y:        -size,
    size,
    baseSize: size,
    speed:    80 + game.elapsed * 2.6 + game.ram * 1.1,
    rotation: (Math.random() - 0.5) * 0.09,
    seed:     Math.random() * 1000,
    resolved: false,
    pulse:    0,
  };
}

function resolveAction(action) {
  if (game.state === "idle") { resetGame(); return; }
  if (game.state !== "running" || !game.activePage || game.activePage.resolved) return;

  const page = game.activePage;
  page.resolved = true;

  const correct =
    (action === "compress" && page.type === "structured") ||
    (action === "raw"      && page.type === "random");

  if (correct) {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.correctCount++;
  } else {
    game.combo = 0;
  }

  const comboMult = Math.min(game.combo, MAX_COMBO);

  if (action === "compress" && page.type === "structured") {
    const bonus = STRUCTURED_SAVE * (1 + (comboMult - 1) * 0.15);
    game.score += Math.round(bonus);
    game.ram   += COMPRESSED_RAM_COST;
    emitParticles(page.x, page.y, "#3ee7ff", 20);
    el.gameStage.classList.remove("success-flash");
    void el.gameStage.offsetWidth;
    el.gameStage.classList.add("success-flash");
    setStatus(`SVD success! Page shrank 75%. ${comboMult > 1 ? "COMBO ×"+comboMult+"!" : ""}`, "success");

  } else if (action === "compress" && page.type === "random") {
    game.ram += ERROR_RAM_PENALTY;
    el.gameStage.classList.remove("shake", "error-flash");
    void el.gameStage.offsetWidth;
    el.gameStage.classList.add("shake", "error-flash");
    emitParticles(page.x, page.y, "#ff4d6d", 32);
    setStatus("Reconstruction error! Random noise resisted SVD. RAM pressure spiked.", "error");

  } else if (action === "raw" && page.type === "random") {
    game.score += 200 * (1 + (comboMult - 1) * 0.1);
    game.ram   += RAW_RAM_COST;
    emitParticles(page.x, page.y, "#72ff9f", 14);
    setStatus(`Correct! Noisy page stored raw. ${comboMult > 1 ? "COMBO ×"+comboMult+"!" : ""}`, "success");

  } else {
    // structured stored raw
    game.ram += RAW_RAM_COST;
    emitParticles(page.x, page.y, "#ffd166", 14);
    setStatus("Stored raw: structured bytes left uncompressed — SVD would have saved more.", "warn");
  }

  if (game.combo >= 2) showComboPopup(game.combo);

  game.activePage  = null;
  game.nextSpawnIn = Math.max(0.20, 0.92 - game.elapsed * 0.014);
  updateHud();
  checkCrash();
}

function showComboPopup(combo) {
  el.comboPopup.textContent = `COMBO ×${combo}!`;
  el.comboPopup.classList.remove("hidden");
  clearTimeout(el.comboPopup._timer);
  el.comboPopup._timer = setTimeout(() => el.comboPopup.classList.add("hidden"), 1500);
}

function emitParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 160;
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life:    0.5 + Math.random() * 0.5,
      maxLife: 1.0,
      color,
      size: 1.5 + Math.random() * 3,
    });
  }
}

function updateGame(dt) {
  if (game.state !== "running") return;

  const rect     = gameCanvas.getBoundingClientRect();
  game.elapsed  += dt;
  game.pressure  = 1 + game.elapsed * 0.032 + game.ram * 0.011;
  game.ram      += dt * PASSIVE_RAM_RATE * game.pressure;

  if (game.messageTimer > 0) {
    game.messageTimer -= dt;
  } else {
    el.statusText.textContent = "Incoming pages accelerate as memory pressure rises…";
    el.statusMessage.querySelector(".status-dot").className = "status-dot idle";
  }

  if (!game.activePage) {
    game.nextSpawnIn -= dt;
    if (game.nextSpawnIn <= 0) spawnPage();
  } else {
    const page = game.activePage;
    page.speed += dt * 8;
    page.y     += page.speed * dt * game.pressure;
    page.pulse  = (page.pulse || 0) + dt * 3;

    const ramGate = rect.height - 92;
    if (page.y > ramGate) {
      game.ram    += RAW_RAM_COST;
      game.combo   = 0;
      setStatus("Page reached RAM unhandled — stored raw without classification.", "warn");
      emitParticles(page.x, ramGate, "#ffd166", 14);
      game.activePage  = null;
      game.nextSpawnIn = 0.30;
      updateHud();
    }
  }

  // Particles
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 90 * dt;
    p.vx   *= 0.98;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  checkCrash();
}

function checkCrash() {
  if (game.ram < 100 || game.state !== "running") return;

  game.ram   = 100;
  game.state = "gameOver";
  game.activePage = null;

  // Update session
  session.gamesPlayed++;
  if (game.score   > session.bestScore) session.bestScore = game.score;
  if (game.maxCombo > session.bestCombo) session.bestCombo = game.maxCombo;
  session.correctTotal += game.correctCount;

  el.finalScore.textContent = `Bytes saved: ${game.score.toLocaleString()}`;
  el.finalCombo.textContent = game.maxCombo > 1 ? `Best combo streak: ×${game.maxCombo}` : "";
  el.gameOverOverlay.classList.remove("hidden");
  setStatus("System crash. RAM capacity reached 100%.", "error");
  updateHud();
  updateSessionStats();
}

function updateHud() {
  const ram    = Math.max(0, Math.min(100, game.ram));
  const combo  = Math.max(1, game.combo);

  el.scoreValue.textContent   = game.score.toLocaleString();
  el.comboValue.textContent   = `×${combo}`;
  el.ramValue.textContent     = `${Math.round(ram)}%`;
  el.ramFill.style.width      = `${ram}%`;
  el.pressureValue.textContent = `${game.pressure.toFixed(1)}×`;

  // Dynamic RAM fill color via CSS variable override
  const pct = ram / 100;
  if (pct < 0.6) {
    el.ramFill.style.boxShadow = "0 0 18px rgba(114,255,159,0.4)";
  } else if (pct < 0.85) {
    el.ramFill.style.boxShadow = "0 0 18px rgba(255,209,102,0.4)";
  } else {
    el.ramFill.style.boxShadow = "0 0 18px rgba(255,77,109,0.5)";
  }

  el.ramFill.setAttribute("aria-valuenow", Math.round(ram));

  const hasTarget = game.state === "running" && Boolean(game.activePage);
  el.compressButton.disabled = !hasTarget;
  el.rawButton.disabled      = !hasTarget;
}

function updateSessionStats() {
  el.gamesPlayed.textContent  = session.gamesPlayed;
  el.correctDecisions.textContent = session.correctTotal;
  el.bestScore.textContent    = session.bestScore > 0 ? session.bestScore.toLocaleString() : "—";
  el.bestCombo.textContent    = session.bestCombo > 0 ? `×${session.bestCombo}` : "—";
}

/* ─────────────────────────────────────────────
   8.  DRAWING
───────────────────────────────────────────── */
function drawGame() {
  const rect = gameCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawGameBackground(rect);
  drawRamGate(rect);

  if (game.activePage) drawPage(game.activePage, performance.now() * 0.001);

  // Particles
  for (const p of game.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (game.state === "idle") drawIdleHint(rect);
}

function drawGameBackground(rect) {
  const grad = ctx.createLinearGradient(0, 0, 0, rect.height);
  grad.addColorStop(0, "#020a0e");
  grad.addColorStop(1, "#030d12");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Horizontal scan lines
  const offset = (game.elapsed * 88 * game.pressure) % 52;
  ctx.strokeStyle = "rgba(62, 231, 255, 0.06)";
  ctx.lineWidth   = 1;
  for (let y = -52 + offset; y < rect.height; y += 52) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y + 20);
    ctx.stroke();
  }

  // Vertical guide rails
  ctx.strokeStyle = "rgba(114, 255, 159, 0.10)";
  ctx.setLineDash([8, 14]);
  ctx.beginPath();
  ctx.moveTo(rect.width * 0.18, 0); ctx.lineTo(rect.width * 0.18, rect.height);
  ctx.moveTo(rect.width * 0.82, 0); ctx.lineTo(rect.width * 0.82, rect.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Subtle center lane highlight
  ctx.fillStyle = "rgba(62, 231, 255, 0.04)";
  ctx.fillRect(rect.width * 0.18, 0, rect.width * 0.64, rect.height);
}

function drawRamGate(rect) {
  const y = rect.height - 92;

  // Gate fill
  const gateGrad = ctx.createLinearGradient(0, y, 0, rect.height);
  gateGrad.addColorStop(0, "rgba(114, 255, 159, 0.08)");
  gateGrad.addColorStop(1, "rgba(114, 255, 159, 0.04)");
  ctx.fillStyle = gateGrad;
  ctx.fillRect(0, y, rect.width, rect.height);

  // Gate line with pulse
  const pulseBright = 0.5 + 0.2 * Math.sin(performance.now() * 0.003);
  ctx.strokeStyle = `rgba(114, 255, 159, ${pulseBright})`;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(rect.width, y);
  ctx.stroke();

  ctx.fillStyle = "rgba(238, 252, 255, 0.8)";
  ctx.font      = "700 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("RAM ENTRY BUS", 18, y + 28);

  // RAM % inside gate
  const ram = Math.max(0, Math.min(100, game.ram));
  const col = ram < 60 ? "#72ff9f" : ram < 85 ? "#ffd166" : "#ff4d6d";
  ctx.fillStyle = col;
  ctx.font      = "800 13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(ram)}% used`, rect.width - 18, y + 28);
  ctx.textAlign = "left";
}

function drawPage(page, time) {
  const { size, type } = page;
  const half = size / 2;
  const pulseFactor = 1 + 0.03 * Math.sin(page.pulse * 2);

  ctx.save();
  ctx.translate(page.x, page.y);
  ctx.rotate(page.rotation);
  ctx.scale(pulseFactor, pulseFactor);

  // Shadow glow
  if (type === "structured") {
    ctx.shadowColor = "rgba(62, 231, 255, 0.5)";
  } else {
    ctx.shadowColor = "rgba(255, 77, 109, 0.5)";
  }
  ctx.shadowBlur = 18;

  // Body fill
  if (type === "structured") {
    const fill = ctx.createLinearGradient(-half, -half, half, half);
    fill.addColorStop(0, "#1bc9ff");
    fill.addColorStop(1, "#0c5dc9");
    ctx.fillStyle   = fill;
    ctx.strokeStyle = "rgba(180, 246, 255, 0.9)";
  } else {
    const fill = ctx.createLinearGradient(-half, -half, half, half);
    fill.addColorStop(0, "#ff4d6d");
    fill.addColorStop(1, "#8e1230");
    ctx.fillStyle   = fill;
    ctx.strokeStyle = "rgba(255, 190, 202, 0.88)";
  }

  roundRect(-half, -half, size, size, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth  = 2.5;
  ctx.stroke();

  // Inner pattern
  if (type === "structured") drawStructuredPattern(size);
  else drawNoisePattern(size, page.seed + time * 7);

  // Label bar
  ctx.fillStyle = "rgba(1, 7, 10, 0.72)";
  ctx.fillRect(-half, half - 22, size, 22);
  ctx.fillStyle = "#eefcff";
  ctx.font      = "700 10px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(type === "structured" ? "LOW-RANK" : "RANDOM", 0, half - 7);
  ctx.textAlign = "left";

  ctx.restore();
}

function drawStructuredPattern(size) {
  const half = size / 2;
  ctx.strokeStyle = "rgba(238, 252, 255, 0.42)";
  ctx.lineWidth   = 1;
  for (let i = 1; i < 4; i++) {
    const t = -half + (size / 4) * i;
    ctx.beginPath();
    ctx.moveTo(-half + 8, t); ctx.lineTo(half - 8, t);
    ctx.moveTo(t, -half + 8); ctx.lineTo(t, half - 26);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(238, 252, 255, 0.68)";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if ((r + c) % 2 === 0) ctx.fillRect(-half + 14 + c * 15, -half + 13 + r * 15, 7, 7);
    }
  }
}

function drawNoisePattern(size, seed) {
  const half = size / 2;
  const cell = Math.max(4.5, size / 10);
  for (let y = -half + 6; y < half - 24; y += cell) {
    for (let x = -half + 6; x < half - 6; x += cell) {
      const v = pseudoRandom(seed + x * 13.7 + y * 7.3);
      ctx.fillStyle = v > 0.5
        ? "rgba(255, 240, 244, 0.72)"
        : "rgba(40, 0, 14, 0.55)";
      ctx.fillRect(x, y, cell - 1, cell - 1);
    }
  }
}

function drawIdleHint(rect) {
  ctx.fillStyle = "rgba(238, 252, 255, 0.68)";
  ctx.font      = "600 13px 'Inter', ui-sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Boot the memory manager to begin.", rect.width / 2, rect.height - 120);
  ctx.textAlign = "left";
}

/* ─────────────────────────────────────────────
   9.  HELPERS
───────────────────────────────────────────── */
function pseudoRandom(v) {
  const x = Math.sin(v) * 10000;
  return x - Math.floor(x);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/* ─────────────────────────────────────────────
   10. MAIN LOOP
───────────────────────────────────────────── */
function loop(time) {
  const dt = Math.min(0.05, (time - game.lastTime) / 1000 || 0.016);
  game.lastTime = time;
  updateGame(dt);
  updateHud();
  drawGame();
  requestAnimationFrame(loop);
}

/* ─────────────────────────────────────────────
   11. SVD VISUALIZER
───────────────────────────────────────────── */
const N = 16; // visualisation matrix size
let currentMatrix = null;

function makeStructuredMatrix() {
  const A = [];
  for (let i = 0; i < N; i++) {
    A.push([]);
    for (let j = 0; j < N; j++) {
      // Low-rank: sum of a few outer products
      let v = 0;
      for (let r = 0; r < 3; r++) {
        v += Math.sin((i + r * 3) * 0.5) * Math.cos((j + r * 2) * 0.6);
      }
      A[i].push((v + 1.5) / 3); // normalise to [0,1]
    }
  }
  return A;
}

function makeRandomMatrix() {
  const A = [];
  for (let i = 0; i < N; i++) {
    A.push([]);
    for (let j = 0; j < N; j++) A[i].push(Math.random());
  }
  return A;
}

// Simple power-iteration SVD approximation for visualisation
function truncatedSVD(A, k) {
  const m = A.length, n = A[0].length;
  const Us = [], Ss = [], Vs = [];

  // Work on a copy
  let R = A.map(r => [...r]);

  for (let s = 0; s < k; s++) {
    // Random init vector
    let v = Array.from({ length: n }, () => Math.random() - 0.5);
    // Power iterations
    for (let iter = 0; iter < 30; iter++) {
      let u = matMulVec(R, v);
      let sigma = norm(u);
      if (sigma < 1e-12) break;
      u = u.map(x => x / sigma);
      v = matTMulVec(R, u);
      sigma = norm(v);
      if (sigma < 1e-12) break;
      v = v.map(x => x / sigma);
    }
    let u = matMulVec(R, v);
    const sigma = norm(u);
    if (sigma < 1e-10) break;
    u = u.map(x => x / sigma);

    Us.push(u); Ss.push(sigma); Vs.push(v);

    // Deflate
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        R[i][j] -= sigma * u[i] * v[j];
  }
  return { Us, Ss, Vs };
}

function reconstruct(Us, Ss, Vs, k) {
  const m = Us[0]?.length || N;
  const n = Vs[0]?.length || N;
  const A = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let s = 0; s < Math.min(k, Us.length); s++) {
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        A[i][j] += Ss[s] * Us[s][i] * Vs[s][j];
  }
  return A;
}

function matMulVec(A, v) {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}
function matTMulVec(A, u) {
  const n = A[0].length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < n; j++)
      result[j] += A[i][j] * u[i];
  return result;
}
function norm(v) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)); }

function frobeniusError(A, B) {
  let s = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++)
      s += (A[i][j] - B[i][j]) ** 2;
  return Math.sqrt(s);
}

function drawMatrix(ctx, canvas, M, label) {
  const W = canvas.width, H = canvas.height;
  const cellW = W / M[0].length, cellH = H / M.length;
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[0].length; j++) {
      let v = Math.max(0, Math.min(1, M[i][j]));
      // Map value to cyan-tinted color
      const r = Math.round(v * 62);
      const g = Math.round(60 + v * 171);
      const b = Math.round(80 + v * 175);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(j * cellW, i * cellH, cellW, cellH);
    }
  }
}

function runVisualizer() {
  if (!currentMatrix) currentMatrix = makeStructuredMatrix();
  const k = parseInt(el.rankSlider.value, 10);
  el.rankValue.textContent = k;

  const { Us, Ss, Vs } = truncatedSVD(currentMatrix, Math.min(k, N));
  const recon = reconstruct(Us, Ss, Vs, k);

  drawMatrix(origCtx, originalCanvas, currentMatrix);
  drawMatrix(compCtx, compressedCanvas, recon);

  // Stats
  const origSize   = N * N;
  const compSize   = k * (1 + N + N); // sigma + u + v per component
  const ratio      = compSize / origSize;
  const err        = frobeniusError(currentMatrix, recon) / (N * N);

  el.compressionRatio.textContent = `${(ratio * 100).toFixed(1)}%`;
  el.reconstructionError.textContent = err.toFixed(4);

  const threshold = 0.02;
  const accepted  = ratio < 1.0 && err < threshold;
  el.compressionDecision.textContent = accepted ? "✓ Compress" : "✗ Store Raw";
  el.compressionDecision.style.color = accepted ? "var(--green)" : "var(--red)";
}

el.rankSlider.addEventListener("input",  runVisualizer);
el.genStructured.addEventListener("click", () => {
  currentMatrix = makeStructuredMatrix(); runVisualizer();
});
el.genRandom.addEventListener("click", () => {
  currentMatrix = makeRandomMatrix(); runVisualizer();
});

/* ─────────────────────────────────────────────
   12. CHARTS (canvas-based)
───────────────────────────────────────────── */
function drawSavingsChart() {
  const canvas = document.getElementById("savingsChart");
  if (!canvas) return;
  const c = canvas.getContext("2d");
  const W = canvas.offsetWidth, H = 180;
  canvas.width  = W * (window.devicePixelRatio || 1);
  canvas.height = H * (window.devicePixelRatio || 1);
  c.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  const ranks   = [1, 2, 4, 6, 8, 10, 12, 16];
  const savings = ranks.map(k => Math.max(0, (1 - (k * (1 + N + N)) / (N * N)) * 100));
  const pad     = { t: 12, r: 12, b: 36, l: 36 };
  const chartW  = W - pad.l - pad.r;
  const chartH  = H - pad.t - pad.b;
  const barW    = (chartW / ranks.length) * 0.55;
  const gap     = (chartW / ranks.length) * 0.45;
  const maxSave = 100;

  // Axes
  c.strokeStyle = "rgba(62,231,255,0.18)";
  c.lineWidth   = 1;
  c.beginPath();
  c.moveTo(pad.l, pad.t); c.lineTo(pad.l, pad.t + chartH);
  c.lineTo(pad.l + chartW, pad.t + chartH);
  c.stroke();

  ranks.forEach((rank, i) => {
    const sv  = savings[i];
    const bH  = (sv / maxSave) * chartH;
    const x   = pad.l + i * (barW + gap) + gap / 2;
    const y   = pad.t + chartH - bH;

    const grad = c.createLinearGradient(0, y, 0, y + bH);
    grad.addColorStop(0, "rgba(62,231,255,0.9)");
    grad.addColorStop(1, "rgba(114,255,159,0.5)");
    c.fillStyle    = grad;
    c.shadowColor  = "rgba(62,231,255,0.3)";
    c.shadowBlur   = 8;
    c.beginPath();
    c.roundRect(x, y, barW, bH, 4);
    c.fill();
    c.shadowBlur = 0;

    // Label
    c.fillStyle  = "rgba(238,252,255,0.6)";
    c.font       = "600 10px Inter, sans-serif";
    c.textAlign  = "center";
    c.fillText(`k=${rank}`, x + barW / 2, pad.t + chartH + 16);

    if (sv > 5) {
      c.fillStyle = "rgba(238,252,255,0.85)";
      c.font      = "700 10px Inter, sans-serif";
      c.fillText(`${sv.toFixed(0)}%`, x + barW / 2, y - 4);
    }
  });
  c.textAlign = "left";
}

function drawPressureChart() {
  const canvas = document.getElementById("pressureChart");
  if (!canvas) return;
  const c = canvas.getContext("2d");
  const W = canvas.offsetWidth, H = 180;
  canvas.width  = W * (window.devicePixelRatio || 1);
  canvas.height = H * (window.devicePixelRatio || 1);
  c.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  const pad    = { t: 12, r: 12, b: 36, l: 36 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const pts    = 40;

  // Axes
  c.strokeStyle = "rgba(62,231,255,0.18)";
  c.lineWidth   = 1;
  c.beginPath();
  c.moveTo(pad.l, pad.t); c.lineTo(pad.l, pad.t + chartH);
  c.lineTo(pad.l + chartW, pad.t + chartH);
  c.stroke();

  // Threshold line (cyan gradient)
  const thresholdData = Array.from({ length: pts }, (_, i) => {
    const pressure = 1 + i / (pts - 1) * 3;
    return Math.max(0.005, 0.05 - (pressure - 1) * 0.013);
  });
  const maxT = Math.max(...thresholdData);

  const grad = c.createLinearGradient(pad.l, 0, pad.l + chartW, 0);
  grad.addColorStop(0, "rgba(62,231,255,0.9)");
  grad.addColorStop(1, "rgba(255,77,109,0.9)");

  c.strokeStyle = grad;
  c.lineWidth   = 2.5;
  c.lineJoin    = "round";
  c.shadowColor = "rgba(62,231,255,0.4)";
  c.shadowBlur  = 10;
  c.beginPath();
  thresholdData.forEach((t, i) => {
    const x = pad.l + (i / (pts - 1)) * chartW;
    const y = pad.t + chartH - (t / maxT) * chartH;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.stroke();
  c.shadowBlur = 0;

  // Fill under curve
  const areaGrad = c.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  areaGrad.addColorStop(0, "rgba(62,231,255,0.14)");
  areaGrad.addColorStop(1, "rgba(62,231,255,0)");
  c.fillStyle = areaGrad;
  c.beginPath();
  thresholdData.forEach((t, i) => {
    const x = pad.l + (i / (pts - 1)) * chartW;
    const y = pad.t + chartH - (t / maxT) * chartH;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.lineTo(pad.l + chartW, pad.t + chartH);
  c.lineTo(pad.l, pad.t + chartH);
  c.closePath();
  c.fill();

  // Axis labels
  c.fillStyle = "rgba(143,184,192,0.7)";
  c.font      = "600 10px Inter, sans-serif";
  c.textAlign = "center";
  ["Low", "Medium", "High", "Critical"].forEach((label, i) => {
    const x = pad.l + (i / 3) * chartW;
    c.fillText(label, x, pad.t + chartH + 16);
  });
  c.textAlign = "left";
}

/* ─────────────────────────────────────────────
   13. SCROLL ANIMATIONS
───────────────────────────────────────────── */
function setupScrollAnimations() {
  const reveals = document.querySelectorAll(
    ".metric-card, .pipeline-step, .chart-card, .abstract-text, .svd-visualizer, .comparison-table-wrap, .sidebar-card"
  );
  reveals.forEach(el => el.classList.add("reveal"));

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          // Animate metric bars
          const bar = entry.target.querySelector(".metric-bar");
          if (bar) {
            const target = bar.style.getPropertyValue("--target-width");
            setTimeout(() => { bar.style.width = target; }, 100);
          }
          // Animate counters
          const val = entry.target.querySelector(".metric-value[data-target]");
          if (val) animateCounter(val);
        }
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach(r => observer.observe(r));
}

function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || "";
  const dur    = 1400;
  const start  = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * ease) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

// Hero stat counters
function animateHeroStats() {
  document.querySelectorAll(".stat-number").forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const dur = 1600;
    const start = performance.now();
    function step(now) {
      const t    = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * ease);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ─────────────────────────────────────────────
   14. HEADER SCROLL EFFECT
───────────────────────────────────────────── */
function setupHeader() {
  const header = document.querySelector(".site-header");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });
}

/* ─────────────────────────────────────────────
   15. HAMBURGER / MOBILE MENU
───────────────────────────────────────────── */
function setupMobileMenu() {
  el.hamburgerBtn.addEventListener("click", () => {
    const isOpen = el.mobileMenu.classList.toggle("open");
    el.hamburgerBtn.classList.toggle("open", isOpen);
    el.hamburgerBtn.setAttribute("aria-expanded", isOpen);
  });

  el.mobileMenu.querySelectorAll(".mobile-link").forEach(link => {
    link.addEventListener("click", () => {
      el.mobileMenu.classList.remove("open");
      el.hamburgerBtn.classList.remove("open");
      el.hamburgerBtn.setAttribute("aria-expanded", "false");
    });
  });
}

/* ─────────────────────────────────────────────
   16. EVENT LISTENERS
───────────────────────────────────────────── */
el.startButton.addEventListener("click",   resetGame);
el.restartButton.addEventListener("click", resetGame);
el.compressButton.addEventListener("click", () => resolveAction("compress"));
el.rawButton.addEventListener("click",      () => resolveAction("raw"));

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    resolveAction("compress");
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    resolveAction("raw");
  } else if ((e.key === " " || e.key === "Enter") && game.state !== "running") {
    e.preventDefault();
    resetGame();
  }
});

window.addEventListener("resize", () => {
  resizeMatrixCanvas();
  resizeGameCanvas();
  drawSavingsChart();
  drawPressureChart();
}, { passive: true });

/* ─────────────────────────────────────────────
   17. INIT
───────────────────────────────────────────── */
resizeMatrixCanvas();
resizeGameCanvas();
updateHud();
drawGame();
requestAnimationFrame(drawMatrixRain);
requestAnimationFrame(loop);

// Visualizer & Charts
currentMatrix = makeStructuredMatrix();
runVisualizer();

// Wait for layout to settle
setTimeout(() => {
  drawSavingsChart();
  drawPressureChart();
  setupScrollAnimations();
  animateHeroStats();
  setupHeader();
  setupMobileMenu();
}, 120);
