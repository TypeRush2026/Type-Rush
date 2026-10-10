(() => {
  const canvas = document.getElementById('tank');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  const ui = {
    score: $('score'),
    best: $('best'),
    level: $('level'),
    typed: $('typedCount'),
    collisions: $('collisionCount'),
    status: $('statusText'),
    start: $('startOverlay'),
    pause: $('pauseOverlay'),
    over: $('gameOverOverlay'),
    finalScore: $('finalScore'),
    finalGuided: $('finalGuided'),
    soundStatus: $('soundStatus')
  };

  let W = 0, H = 0, dpr = 1;
  let running = false, paused = false, over = false;
  let fish = [], bubbles = [], particles = [], plants = [];
  let lastTime = 0, spawnTimer = 0;
  let score = 0, guided = 0, collisions = 0, elapsed = 0, fishId = 0;
  let soundOn = false, audioCtx = null, mistakes = 0;
  let best = Number(localStorage.getItem('aquatypeBest') || 0);

  ui.best.textContent = String(best).padStart(5, '0');

  const rand = (a, b) => a + Math.random() * (b - a);
  const letters = 'ASDFGHJKLQWERTYUIOPZXCVBNM';

  function resize() {
    const rect = canvas.getBoundingClientRect();

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    plants = [];

    for (let i = 0; i < Math.max(12, Math.floor(W / 30)); i++) {
      plants.push({
        x: rand(-10, W + 10),
        h: rand(25, 100),
        w: rand(5, 16),
        phase: rand(0, 6.28),
        color: Math.random()
      });
    }

    if (!bubbles.length) {
      for (let i = 0; i < 50; i++) {
        bubbles.push({
          x: rand(0, W),
          y: rand(0, H),
          r: rand(1, 4),
          speed: rand(8, 30),
          drift: rand(-7, 7),
          alpha: rand(.12, .55)
        });
      }
    }
  }

  window.addEventListener('resize', resize);
  resize();

  function makeFish() {
    const colors = [
      ['#ffb45e', '#ff704f', '#ffe2a0'],
      ['#72f0d8', '#2cb9b7', '#c9fff2'],
      ['#9bc5ff', '#5478ee', '#e1e9ff'],
      ['#ff91c9', '#e94e99', '#ffd6e9'],
      ['#f6dc79', '#ee9c36', '#fff0b3'],
      ['#c6a1ff', '#8b67e8', '#eee1ff']
    ];

    const c = colors[Math.floor(Math.random() * colors.length)];
    const size = rand(25, 38);
    const y = rand(95, Math.max(110, H - 95));

    const f = {
      id: ++fishId,
      x: rand(-40, Math.max(0, W * .65)),
      y,
      baseY: y,
      vx: rand(24, 42) + (score / 120) + (mistakes * 2.5),
      vy: rand(-9, 9),
      size,
      letter: letters[Math.floor(Math.random() * letters.length)],
      c,
      phase: rand(0, 6.28),
      tail: 0,
      glow: rand(.2, .5),
      active: true,
      hit: false
    };

    fish.push(f);
  }

  function startGame() {
    fish = [];
    particles = [];

    score = 0;
    guided = 0;
    collisions = 0;
    elapsed = 0;
    spawnTimer = .5;
    fishId = 0;
    mistakes = 0;

    over = false;
    paused = false;
    running = true;

    for (let i = 0; i < 4; i++) {
      makeFish();
    }

    ui.start.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.over.classList.add('hidden');

    ui.status.textContent = 'SCHOOL IS SWIMMING';

    updateUI();
  }

  function updateUI() {
    ui.score.textContent = String(score).padStart(5, '0');
    ui.best.textContent = String(best).padStart(5, '0');
    ui.typed.textContent = guided;
    ui.collisions.textContent = collisions;

    ui.level.textContent = String(
      1 + Math.floor(score / 120)
    ).padStart(2, '0');

    [1, 2, 3].forEach(n => {
      $('life' + n).classList.toggle('lost', n <= collisions);
    });
  }

  function finish() {
    running = false;
    over = true;

    ui.status.textContent = 'DIVE COMPLETE';
    ui.finalScore.textContent = score;
    ui.finalGuided.textContent = guided;

    if (score > best) {
      best = score;
      localStorage.setItem('aquatypeBest', best);
      updateUI();
    }

    ui.over.classList.remove('hidden');
  }

  function togglePause() {
    if (!running || over) return;

    paused = !paused;

    ui.pause.classList.toggle('hidden', !paused);

    ui.status.textContent = paused
      ? 'PAUSED'
      : 'SCHOOL IS SWIMMING';
  }

  function beep(freq = 520, duration = .08) {
    if (!soundOn) return;

    try {
      audioCtx = audioCtx ||
        new (window.AudioContext || window.webkitAudioContext)();

      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.connect(g);
      g.connect(audioCtx.destination);

      o.frequency.value = freq;
      o.type = 'sine';

      g.gain.value = .045;

      o.start();

      g.gain.exponentialRampToValueAtTime(
        .001,
        audioCtx.currentTime + duration
      );

      o.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function guideFish(f) {
    f.hit = true;

    score += 10 + Math.floor(f.size / 4);
    guided++;

    beep(620 + Math.random() * 300, .1);

    for (let i = 0; i < 18; i++) {
      particles.push({
        x: f.x,
        y: f.y,
        vx: rand(-80, 80),
        vy: rand(-80, 80),
        life: rand(.3, .8),
        max: .8,
        r: rand(1, 4),
        color: f.c[0]
      });
    }

    f.vx = Math.max(f.vx * 2.8, 160);
    f.letter = '';

    updateUI();
  }

  // Keyboard typing controls
  window.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Escape' || e.code === 'Space') {
      if (e.code === 'Space' && e.target.tagName === 'BUTTON') return;

      e.preventDefault();
      togglePause();
      return;
    }

    if (!running || paused || e.key.length !== 1 ||
        !/[a-z]/i.test(e.key)) {
      return;
    }

    const key = e.key.toUpperCase();

    const targets = fish.filter(
      f => !f.hit && f.letter === key
    );

    // Wrong letter typed: increase difficulty
    if (!targets.length) {
      mistakes++;

      for (const f of fish) {
        if (!f.hit) {
          f.vx = Math.min(f.vx * 1.08 + 2, 150);
        }
      }

      const maxFish = Math.min(
        14,
        4 + Math.floor(score / 90) + Math.floor(mistakes / 2)
      );

      if (fish.filter(f => !f.hit).length < maxFish) {
        spawnTimer = Math.min(spawnTimer, .12);
      } else {
        spawnTimer = Math.min(spawnTimer, .3);
      }

      beep(170, .06);
      return;
    }

    targets.sort(
      (a, b) => nearestDistance(a) - nearestDistance(b)
    );

    guideFish(targets[0]);
  });

  function nearestDistance(a) {
    let d = Infinity;

    for (const b of fish) {
      if (a !== b && !b.hit) {
        d = Math.min(d, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }

    return d;
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);

    g.addColorStop(0, '#0b5268');
    g.addColorStop(.48, '#06415a');
    g.addColorStop(1, '#021b32');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 7; i++) {
      const x = ((i * W / 5 + t * .012) % (W + 160)) - 80;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + randStatic(i) * 45, H * .78);
      ctx.lineTo(x + randStatic(i) * 100, H * .78);
      ctx.closePath();

      const gr = ctx.createLinearGradient(x, 0, x + 80, H * .8);

      gr.addColorStop(0, '#8fffff12');
      gr.addColorStop(1, '#6bfff900');

      ctx.fillStyle = gr;
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = '#0a5c6170';
    ctx.beginPath();
    ctx.moveTo(0, H * .77);

    for (let x = 0; x <= W; x += 45) {
      ctx.lineTo(
        x,
        H * .77 + Math.sin(x * .013 + t * .0005) * 10
      );
    }

    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    ctx.save();

    ctx.globalAlpha = .11;
    ctx.strokeStyle = '#a8fff0';
    ctx.lineWidth = 1;

    for (let j = 0; j < 12; j++) {
      ctx.beginPath();

      for (let x = 0; x < W; x += 10) {
        const y = 25 + j * 19
          + Math.sin(x * .018 + t * .0008 + j) * 5
          + Math.sin(x * .04 - t * .0004) * 2;

        x === 0
          ? ctx.moveTo(x, y)
          : ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  function randStatic(n) {
    return .35 + ((Math.sin(n * 91.7) * 43758.5) % 1 + 1) % 1 * .65;
  }

  function drawPlants(t) {
    for (const p of plants) {
      ctx.save();

      ctx.translate(p.x, H + 4);
      ctx.rotate(Math.sin(t * .001 + p.phase) * .08);

      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);

        ctx.quadraticCurveTo(
          k * p.w * 1.4,
          -p.h * .45,
          k * p.w * .6,
          -p.h
        );

        ctx.quadraticCurveTo(
          k * p.w * .3,
          -p.h * .35,
          0,
          0
        );

        ctx.fillStyle = p.color > .5
          ? '#35b99a55'
          : '#66c9a744';

        ctx.fill();

        ctx.strokeStyle = '#8af5c344';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }

    const sand = ctx.createLinearGradient(0, H - 32, 0, H);

    sand.addColorStop(0, '#b5b16a00');
    sand.addColorStop(1, '#d0b97980');

    ctx.fillStyle = sand;
    ctx.fillRect(0, H - 35, W, 35);

    for (let i = 0; i < Math.floor(W / 15); i++) {
      ctx.beginPath();

      ctx.ellipse(
        (i * 37) % W,
        H - randStatic(i) * 13,
        randStatic(i + 2) * 5,
        2,
        0,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = '#d7d5a855';
      ctx.fill();
    }
  }

  function drawBubbles(dt) {
    for (const b of bubbles) {
      if (running && !paused) {
        b.y -= b.speed * dt;
      }

      if (b.y < -8) {
        b.y = H + 8;
        b.x = rand(0, W);
      }

      ctx.beginPath();

      ctx.arc(
        b.x + Math.sin(b.y * .02) * b.drift,
        b.y,
        b.r,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = `rgba(174,255,255,${b.alpha * .13})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(184,255,255,${b.alpha})`;
      ctx.lineWidth = .8;
      ctx.stroke();

      ctx.beginPath();

      ctx.arc(
        b.x - b.r * .3,
        b.y - b.r * .3,
        Math.max(.5, b.r * .2),
        0,
        Math.PI * 2
      );

      ctx.fillStyle = '#e2ffff80';
      ctx.fill();
    }
  }

  function drawFish(f, t) {
    const bob = Math.sin(t * .002 + f.phase) * 5;
    const x = f.x;
    const y = f.y + bob;
    const s = f.size;
    const dir = 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    ctx.shadowColor = f.c[0];
    ctx.shadowBlur = f.hit ? 28 : 12;

    const tailSwing = Math.sin(t * .012 + f.phase) * .25;

    ctx.save();
    ctx.rotate(tailSwing);

    ctx.beginPath();

    ctx.moveTo(-s * .55, 0);

    ctx.quadraticCurveTo(
      -s * .95, -s * .48,
      -s * 1.08, -s * .43
    );

    ctx.quadraticCurveTo(
      -s * .91, 0,
      -s * 1.08, s * .43
    );

    ctx.quadraticCurveTo(
      -s * .75, s * .34,
      -s * .55, 0
    );

    const tg = ctx.createLinearGradient(-s, 0, -s * .45, 0);

    tg.addColorStop(0, f.c[1]);
    tg.addColorStop(1, f.c[0]);

    ctx.fillStyle = tg;
    ctx.fill();

    ctx.restore();

    // Fish body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * .67, s * .4, 0, 0, Math.PI * 2);

    const bg = ctx.createLinearGradient(
      -s * .4, -s * .4,
      s * .45, s * .4
    );

    bg.addColorStop(0, f.c[2]);
    bg.addColorStop(.34, f.c[0]);
    bg.addColorStop(1, f.c[1]);

    ctx.fillStyle = bg;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Fins
    ctx.beginPath();
    ctx.moveTo(-s * .05, -s * .28);

    ctx.quadraticCurveTo(
      s * .1, -s * .7,
      s * .35, -s * .24
    );

    ctx.closePath();
    ctx.fillStyle = f.c[1];
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * .12, s * .26);

    ctx.quadraticCurveTo(
      s * .12, s * .58,
      s * .36, s * .25
    );

    ctx.closePath();
    ctx.fillStyle = f.c[1];
    ctx.fill();

    // Scales
    ctx.globalAlpha = .28;

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();

      ctx.arc(
        i * s * .2,
        -s * .02,
        s * .12,
        0,
        Math.PI
      );

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Eye
    ctx.beginPath();
    ctx.arc(s * .42, -s * .07, s * .075, 0, Math.PI * 2);

    ctx.fillStyle = '#062537';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(s * .44, -s * .09, s * .025, 0, Math.PI * 2);

    ctx.fillStyle = '#fff';
    ctx.fill();

    // Letter badge
    if (f.letter && !f.hit) {
      const by = -s * .8 + Math.sin(t * .003 + f.phase) * 2;

      ctx.shadowColor = f.c[0];
      ctx.shadowBlur = 16;

      ctx.beginPath();
      ctx.roundRect(-13, by - 13, 26, 26, 8);

      ctx.fillStyle = '#082839eF';
      ctx.fill();

      ctx.strokeStyle = f.c[0];
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.fillStyle = '#f4ffff';
      ctx.font = '700 15px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.letter, 0, by);

      ctx.beginPath();
      ctx.moveTo(0, by + 14);
      ctx.lineTo(0, -s * .48);

      ctx.strokeStyle = f.c[0] + '99';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.vx *= .98;
      p.vy *= .98;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function update(dt, t) {
    if (!running || paused) return;

    elapsed += dt;
    spawnTimer -= dt;

    // Fish count increases with score and wrong typing
    const maxFish = Math.min(
      14,
      4 + Math.floor(score / 90) + Math.floor(mistakes / 2)
    );

    if (
      spawnTimer <= 0 &&
      fish.filter(f => !f.hit).length < maxFish
    ) {
      makeFish();

      // More mistakes = faster fish spawning
      spawnTimer = Math.max(
        .18,
        1.8 - score * .003 - mistakes * .08
      );
    }

    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];

      f.phase += dt;
      f.tail += dt * 8;

      if (!f.hit) {
        f.x += f.vx * dt;
        f.y += f.vy * dt + Math.sin(t * .001 + f.phase) * dt * 4;

        f.y = Math.max(68, Math.min(H - 64, f.y));

        if (f.y <= 69 || f.y >= H - 65) {
          f.vy *= -1;
        }

        if (f.x > W - f.size * 2) {
          f.x = -f.size;
          f.y = rand(85, H - 70);
        }
      } else {
        f.x += f.vx * dt;
        f.y += Math.sin(t * .004 + f.phase) * dt * 24;

        if (f.x > W + f.size * 2) {
          fish.splice(i, 1);
          continue;
        }
      }
    }

    // Fish collision system
    for (let i = 0; i < fish.length; i++) {
      const a = fish[i];

      if (a.hit || a.bumpCooldown > 0) continue;

      for (let j = i + 1; j < fish.length; j++) {
        const b = fish[j];

        if (b.hit || b.bumpCooldown > 0) continue;

        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const threshold = (a.size + b.size) * .67;

        if (dist < threshold) {
          collisions++;

          a.bumpCooldown = 1.25;
          b.bumpCooldown = 1.25;

          a.vy = rand(-38, 38);
          b.vy = rand(-38, 38);

          a.vx = Math.max(18, a.vx * .72);
          b.vx = Math.max(18, b.vx * .72);

          for (let k = 0; k < 13; k++) {
            particles.push({
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              vx: rand(-90, 90),
              vy: rand(-90, 90),
              life: rand(.25, .55),
              max: .55,
              r: rand(1, 3),
              color: '#c6ffff'
            });
          }

          beep(150, .13);
          updateUI();

          if (collisions >= 3) {
            finish();
            return;
          }

          break;
        }
      }
    }

    for (const f of fish) {
      if (f.bumpCooldown > 0) {
        f.bumpCooldown -= dt;
      }
    }
  }

  function render(t, dt) {
    drawBackground(t);
    drawPlants(t);
    drawBubbles(dt);

    for (const f of fish) {
      drawFish(f, t);
    }

    drawParticles(dt);

    const edge = ctx.createLinearGradient(0, 0, W, 0);

    edge.addColorStop(0, '#b6ffff18');
    edge.addColorStop(.04, '#a6ffff00');
    edge.addColorStop(.96, '#a6ffff00');
    edge.addColorStop(1, '#b6ffff18');

    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }

  function loop(t) {
    const dt = Math.min(.04, (t - lastTime) / 1000 || 0);

    lastTime = t;

    update(dt, t);
    render(t, dt);

    requestAnimationFrame(loop);
  }

  // Buttons
  $('startBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  $('pauseBtn').addEventListener('click', togglePause);
  $('resumeBtn').addEventListener('click', togglePause);

  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;

    ui.soundStatus.textContent = soundOn
      ? 'SOUND ON'
      : 'SOUND OFF';

    $('soundBtn').style.color = soundOn
      ? '#69f2e1'
      : '';

    if (soundOn) {
      beep(700, .08);
    }
  });

  // Fish visible behind the starting screen
  for (let i = 0; i < 4; i++) {
    makeFish();
  }

  requestAnimationFrame(loop);
})();