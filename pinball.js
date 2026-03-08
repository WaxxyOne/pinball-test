const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ballsLeftEl = document.getElementById("balls-left");
const scoreEl = document.getElementById("score");
const layoutNameEl = document.getElementById("layout-name");
const layoutSelectEl = document.getElementById("layout-select");
const gameOverOverlay = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  gravity: 1700,
  restitution: 0.82,
  rollingFriction: 0.994,
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBounceSound(speed) {
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.value = Math.min(0.18, 0.03 + speed / 6000);

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180 + speed * 0.5, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.08);
  osc.connect(gain);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.09);
}

function playRollSound(speed) {
  if (speed < 45) {
    return;
  }
  const duration = 0.045;
  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.min(0.16, speed / 2000);
  }

  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 1.2;

  src.buffer = buffer;
  src.connect(filter).connect(audioCtx.destination);
  src.start();
}

class Ball {
  constructor(x, y) {
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.radius = 12;
    this.inPlay = false;
  }

  update(dt) {
    this.vel.y += WORLD.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.vel.x *= WORLD.rollingFriction;
    this.vel.y *= WORLD.rollingFriction;
  }

  draw() {
    const gradient = ctx.createRadialGradient(
      this.pos.x - 4,
      this.pos.y - 5,
      1,
      this.pos.x,
      this.pos.y,
      this.radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#8ea6c9");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Flipper {
  constructor(anchorX, anchorY, length, side) {
    this.anchor = { x: anchorX, y: anchorY };
    this.length = length;
    this.side = side;
    this.restAngle = side === "left" ? 0.45 : Math.PI - 0.45;
    this.activeAngle = side === "left" ? -0.28 : Math.PI + 0.28;
    this.angle = this.restAngle;
    this.isPressed = false;
  }

  update(dt) {
    const target = this.isPressed ? this.activeAngle : this.restAngle;
    this.angle += (target - this.angle) * Math.min(1, dt * 24);
  }

  getSegment() {
    const tip = {
      x: this.anchor.x + Math.cos(this.angle) * this.length,
      y: this.anchor.y + Math.sin(this.angle) * this.length,
    };
    return { a: this.anchor, b: tip };
  }

  draw() {
    const seg = this.getSegment();
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.strokeStyle = this.side === "left" ? "#ff6ab4" : "#59d7ff";
    ctx.shadowBlur = 15;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(seg.a.x, seg.a.y);
    ctx.lineTo(seg.b.x, seg.b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

class TableLayout {
  constructor(name, bumpers, walls) {
    this.name = name;
    this.bumpers = bumpers;
    this.walls = walls;
  }
}

const layouts = [
  new TableLayout(
    "Classic",
    [
      { x: 290, y: 240, r: 35, color: "#ffe066", score: 150 },
      { x: 450, y: 330, r: 30, color: "#9fff6f", score: 200 },
      { x: 610, y: 220, r: 38, color: "#ff8ef8", score: 250 },
    ],
    [
      [{ x: 110, y: 120 }, { x: 130, y: 1000 }],
      [{ x: 790, y: 120 }, { x: 760, y: 1000 }],
      [{ x: 150, y: 120 }, { x: 740, y: 120 }],
      [{ x: 250, y: 710 }, { x: 390, y: 520 }],
      [{ x: 650, y: 710 }, { x: 510, y: 520 }],
    ]
  ),
  new TableLayout(
    "Orbit",
    [
      { x: 340, y: 270, r: 32, color: "#ff9a5f", score: 120 },
      { x: 520, y: 260, r: 34, color: "#72ffec", score: 140 },
      { x: 430, y: 470, r: 42, color: "#f0ff7a", score: 320 },
    ],
    [
      [{ x: 100, y: 120 }, { x: 130, y: 1020 }],
      [{ x: 810, y: 120 }, { x: 780, y: 1020 }],
      [{ x: 130, y: 120 }, { x: 770, y: 120 }],
      [{ x: 240, y: 600 }, { x: 300, y: 360 }],
      [{ x: 660, y: 600 }, { x: 600, y: 360 }],
      [{ x: 260, y: 830 }, { x: 430, y: 710 }],
      [{ x: 640, y: 830 }, { x: 470, y: 710 }],
    ]
  ),
];

const state = {
  layoutIndex: 0,
  score: 0,
  ballsRemaining: 3,
  ball: null,
  plungerCharge: 0,
  leftFlipper: new Flipper(325, 1030, 140, "left"),
  rightFlipper: new Flipper(575, 1030, 140, "right"),
  gameOver: false,
};

for (const [index, layout] of layouts.entries()) {
  const option = document.createElement("option");
  option.value = index;
  option.textContent = layout.name;
  layoutSelectEl.append(option);
}

function resetBall() {
  state.ball = new Ball(835, 1020);
  state.plungerCharge = 0;
}

function resetGame() {
  state.score = 0;
  state.ballsRemaining = 3;
  state.gameOver = false;
  resetBall();
  gameOverOverlay.classList.add("hidden");
  syncHud();
}

layoutSelectEl.addEventListener("change", (event) => {
  state.layoutIndex = Number(event.target.value);
  layoutNameEl.textContent = `Layout: ${layouts[state.layoutIndex].name}`;
});

restartBtn.addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  if (event.key === "Shift") {
    if (event.location === 1) {
      state.leftFlipper.isPressed = true;
    }
    if (event.location === 2) {
      state.rightFlipper.isPressed = true;
    }
  }

  if (event.key === "Enter" && !state.ball.inPlay && !state.gameOver) {
    state.plungerCharge = Math.min(900, state.plungerCharge + 280);
    launchBall();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Shift") {
    if (event.location === 1) {
      state.leftFlipper.isPressed = false;
    }
    if (event.location === 2) {
      state.rightFlipper.isPressed = false;
    }
  }
});

function launchBall() {
  const launchForce = Math.max(620, state.plungerCharge);
  state.ball.inPlay = true;
  state.ball.vel.y = -launchForce;
  state.ball.vel.x = -120;
  state.plungerCharge = 0;
}

function distancePointToSegment(point, segmentA, segmentB) {
  const abx = segmentB.x - segmentA.x;
  const aby = segmentB.y - segmentA.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentA.x) * abx + (point.y - segmentA.y) * aby) /
        (abx * abx + aby * aby)
    )
  );
  const nearest = { x: segmentA.x + abx * t, y: segmentA.y + aby * t };
  const dx = point.x - nearest.x;
  const dy = point.y - nearest.y;
  return { dist: Math.hypot(dx, dy), nearest, normal: normalize({ x: dx, y: dy }) };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function reflectVelocity(normal) {
  const dot = state.ball.vel.x * normal.x + state.ball.vel.y * normal.y;
  state.ball.vel.x -= (1 + WORLD.restitution) * dot * normal.x;
  state.ball.vel.y -= (1 + WORLD.restitution) * dot * normal.y;
}

function resolveBumperCollisions(layout) {
  for (const bumper of layout.bumpers) {
    const dx = state.ball.pos.x - bumper.x;
    const dy = state.ball.pos.y - bumper.y;
    const dist = Math.hypot(dx, dy);
    const minDist = state.ball.radius + bumper.r;
    if (dist < minDist) {
      const normal = normalize({ x: dx, y: dy });
      state.ball.pos.x = bumper.x + normal.x * minDist;
      state.ball.pos.y = bumper.y + normal.y * minDist;
      reflectVelocity(normal);
      state.ball.vel.x += normal.x * 320;
      state.ball.vel.y += normal.y * 320;
      state.score += bumper.score;
      playBounceSound(Math.hypot(state.ball.vel.x, state.ball.vel.y));
    }
  }
}

function resolveWallCollisions(layout) {
  for (const wall of layout.walls) {
    const hit = distancePointToSegment(state.ball.pos, wall[0], wall[1]);
    if (hit.dist < state.ball.radius) {
      state.ball.pos.x = hit.nearest.x + hit.normal.x * state.ball.radius;
      state.ball.pos.y = hit.nearest.y + hit.normal.y * state.ball.radius;
      reflectVelocity(hit.normal);
      playBounceSound(Math.hypot(state.ball.vel.x, state.ball.vel.y));
    }
  }

  const left = state.ball.radius;
  const right = WORLD.width - state.ball.radius;
  if (state.ball.pos.x < left || state.ball.pos.x > right) {
    state.ball.pos.x = Math.min(right, Math.max(left, state.ball.pos.x));
    state.ball.vel.x *= -WORLD.restitution;
    playBounceSound(Math.abs(state.ball.vel.x));
  }
}

function resolveFlipperCollision(flipper) {
  const segment = flipper.getSegment();
  const hit = distancePointToSegment(state.ball.pos, segment.a, segment.b);
  if (hit.dist < state.ball.radius + 3) {
    const impulse = flipper.isPressed ? 880 : 300;
    state.ball.pos.x = hit.nearest.x + hit.normal.x * (state.ball.radius + 3);
    state.ball.pos.y = hit.nearest.y + hit.normal.y * (state.ball.radius + 3);
    reflectVelocity(hit.normal);
    state.ball.vel.x += hit.normal.x * impulse;
    state.ball.vel.y += hit.normal.y * impulse;
    playBounceSound(impulse);
  }
}

function update(dt) {
  if (state.gameOver) {
    return;
  }

  const layout = layouts[state.layoutIndex];

  state.leftFlipper.update(dt);
  state.rightFlipper.update(dt);

  if (!state.ball.inPlay) {
    state.ball.pos.y = 1020 - state.plungerCharge * 0.12;
  } else {
    state.ball.update(dt);
    resolveBumperCollisions(layout);
    resolveWallCollisions(layout);
    resolveFlipperCollision(state.leftFlipper);
    resolveFlipperCollision(state.rightFlipper);
    playRollSound(Math.abs(state.ball.vel.x));

    if (state.ball.pos.y > WORLD.height + 40) {
      state.ballsRemaining -= 1;
      if (state.ballsRemaining <= 0) {
        state.gameOver = true;
        finalScoreEl.textContent = `Final Score: ${state.score}`;
        gameOverOverlay.classList.remove("hidden");
      } else {
        resetBall();
      }
    }
  }

  syncHud();
}

function drawTable(layout) {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  const bg = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  bg.addColorStop(0, "#143363");
  bg.addColorStop(0.6, "#10244a");
  bg.addColorStop(1, "#08152f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = "#70cbff";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, WORLD.width - 80, WORLD.height - 80);

  for (const wall of layout.walls) {
    const grad = ctx.createLinearGradient(wall[0].x, wall[0].y, wall[1].x, wall[1].y);
    grad.addColorStop(0, "#89e8ff");
    grad.addColorStop(1, "#a6ff88");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(wall[0].x, wall[0].y);
    ctx.lineTo(wall[1].x, wall[1].y);
    ctx.stroke();
  }

  for (const bumper of layout.bumpers) {
    const bumperGrad = ctx.createRadialGradient(bumper.x, bumper.y, 8, bumper.x, bumper.y, bumper.r);
    bumperGrad.addColorStop(0, "#ffffff");
    bumperGrad.addColorStop(0.5, bumper.color);
    bumperGrad.addColorStop(1, "#1a283f");
    ctx.fillStyle = bumperGrad;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f8fdff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "#9bcfff";
  ctx.fillRect(790, 760, 80, 290);
  ctx.fillStyle = "#d9f1ff";
  ctx.fillRect(802, 780 + state.plungerCharge * 0.15, 56, 32);

  state.leftFlipper.draw();
  state.rightFlipper.draw();
  state.ball.draw();
}

function syncHud() {
  ballsLeftEl.textContent = `Balls: ${Math.max(0, state.ballsRemaining)}`;
  scoreEl.textContent = `Score: ${state.score}`;
  layoutNameEl.textContent = `Layout: ${layouts[state.layoutIndex].name}`;
}

let lastTs = performance.now();
function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  drawTable(layouts[state.layoutIndex]);
  requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
