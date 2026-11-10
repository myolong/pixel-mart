// 픽셀편의점: 손님 주문을 보고 아래 상품 버튼을 눌러 맞추는 게임.
'use strict';

(() => {
  // ───────── 기본 값 ─────────
  const W = 144;                 // 논리 화면 폭(픽셀)
  const SHIFT = 150;             // 근무 시간(초): 밤 10시 → 아침 6시
  const MAX_HEARTS = 3;
  const SLOTS = [50, 80, 102, 124];  // 계산대 앞(0)부터 줄 선 자리
  const DOOR_X = 128;
  const UNLOCK_AT = [0, 0, 0, 0, 25, 50, 75, 100]; // 상품별 입고 시각(초)
  const FONT = "'Galmuri11', sans-serif";

  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d');
  const buf = document.createElement('canvas');   // 1배율 픽셀 화면
  const b = buf.getContext('2d');

  let H = 288, sceneB = 176, counterTop = 156, sx = 1, offX = 0, offY = 0;
  let shelfBtns = [];
  let uiBtns = [];
  let bgCache = null;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
  };

  const G = {
    state: 'title',   // title | play | pause | over
    t: 0, score: 0, hearts: MAX_HEARTS, combo: 0, bestCombo: 0, served: 0, lost: 0,
    queue: [], leaving: [], spawnT: 1, unlocked: 4,
    fly: [], floaters: [], coins: [], banner: null, shake: 0, flash: {},
    door: 0, best: parseInt(store.get('pixelmart.best', '0'), 10) || 0,
    newBest: false, cleared: false, endT: 0, anim: 0, round: 0,
  };

  // ───────── 화면 크기 ─────────
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    H = Math.round(Math.max(256, Math.min(320, W * vh / vw)));
    const css = Math.min(vw / W, vh / H);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    screen.style.width = Math.floor(W * css) + 'px';
    screen.style.height = Math.floor(H * css) + 'px';
    screen.width = Math.floor(W * css * dpr);
    screen.height = Math.floor(H * css * dpr);
    sx = screen.width / W;
    buf.width = W; buf.height = H;
    sceneB = H - 112;
    counterTop = sceneB - 20;
    shelfBtns = ITEM_DEFS.map((d, i) => ({
      id: d.id, idx: i,
      x: 3 + (i % 4) * 35, y: sceneB + 6 + Math.floor(i / 4) * 52, w: 33, h: 48,
    }));
    bgCache = null;
  }

  // ───────── 그리기 도구 ─────────
  const rect = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function box(x, y, w, h, fill, border = OUTLINE, shadow = null) {
    if (shadow) rect(x + 1, y + h, w - 1, 2, shadow);
    rect(x + 1, y, w - 2, h, border);
    rect(x, y + 1, w, h - 2, border);
    rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  const spr = (img, x, y, s = 1) => b.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s);

  // 글자는 고해상도 화면에 바로 쓴다(논리 좌표 기준).
  const texts = [];
  function text(str, x, y, size = 7, color = '#fff', align = 'center', opts = {}) {
    texts.push({ str: String(str), x, y, size, color, align, ...opts });
  }
  function flushTexts() {
    sctx.save();
    sctx.setTransform(sx, 0, 0, sx, offX * sx, offY * sx);
    sctx.textBaseline = 'middle';
    for (const t of texts) {
      sctx.font = `${t.bold ? 700 : 400} ${t.size}px ${FONT}`;
      sctx.textAlign = t.align;
      let scale = 1;
      if (t.maxW) {
        const w = sctx.measureText(t.str).width;
        if (w > t.maxW) scale = t.maxW / w;
      }
      sctx.save();
      sctx.translate(t.x, t.y);
      if (scale !== 1) sctx.scale(scale, 1);
      sctx.globalAlpha = t.alpha ?? 1;
      if (t.stroke) {
        sctx.lineWidth = t.strokeW || 2;
        sctx.strokeStyle = t.stroke;
        sctx.lineJoin = 'round';
        sctx.strokeText(t.str, 0, 0);
      }
      sctx.fillStyle = t.color;
      sctx.fillText(t.str, 0, 0);
      sctx.restore();
    }
    sctx.restore();
    texts.length = 0;
  }

  const lerp = (a, c, p) => a + (c - a) * p;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function mixHex(h1, h2, p) {
    const a = parseInt(h1.slice(1), 16), c = parseInt(h2.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (c >> 16) & 255, p));
    const g = Math.round(lerp((a >> 8) & 255, (c >> 8) & 255, p));
    const bl = Math.round(lerp(a & 255, c & 255, p));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ───────── 배경(가게 안) ─────────
  function buildBg() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // 벽
    R(0, 14, W, counterTop - 14, '#f2e6cc');
    for (let y = 22; y < counterTop; y += 4) R(0, y, W, 1, '#ead9b8');
    // 천장 띠와 형광등
    R(0, 14, W, 6, '#26a69a');
    R(0, 19, W, 1, '#1b7f76');
    R(56, 15, 22, 2, '#fffbe6'); R(90, 15, 22, 2, '#fffbe6');
    // 창문 틀(하늘은 매 프레임 그림)
    R(5, 25, 42, 40, '#5b5466');
    R(6, 26, 40, 38, '#000');
    // 뒤쪽 진열대
    const shelfTop = 26, shelfBot = counterTop;
    R(52, shelfTop, 58, shelfBot - shelfTop, '#c9b48f');
    R(53, shelfTop + 1, 56, shelfBot - shelfTop - 1, '#e8d7b4');
    const colors = ['#e2453c', '#f5c542', '#4f8cff', '#46c47e', '#f48fb1', '#f08a24', '#a77bff', '#ffffff', '#7a4a2b'];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = shelfTop + 3; y < shelfBot - 6; y += 13) {
      let x = 55;
      while (x < 106) {
        const w = 3 + Math.floor(rnd() * 3), h = 5 + Math.floor(rnd() * 5);
        const col = colors[Math.floor(rnd() * colors.length)];
        if (x + w > 107) break;
        R(x, y + 10 - h, w, h, col);
        R(x, y + 10 - h, w, 1, '#ffffff55');
        x += w + 1;
      }
      R(53, y + 10, 56, 2, '#a88f66');
    }
    // 자동문 틀
    R(114, 26, 28, counterTop - 26, '#8a93a0');
    R(116, 28, 24, counterTop - 28, '#2a3350');
    // 계산대
    R(0, counterTop, W, 4, '#dfe4ea');
    R(0, counterTop, W, 1, '#ffffff');
    R(0, counterTop + 4, W, 1, '#9aa5ae');
    R(0, counterTop + 5, W, sceneB - counterTop - 5, '#2a8f86');
    R(0, counterTop + 9, W, 2, '#ffd84d');
    for (let x = 6; x < W; x += 24) R(x, counterTop + 13, 12, 1, '#23786f');
    // 포스기
    R(4, counterTop - 14, 20, 12, '#3b3f4a');
    R(6, counterTop - 12, 16, 7, '#7de0c6');
    R(7, counterTop - 11, 9, 1, '#b8f5e4');
    R(10, counterTop - 2, 8, 2, '#3b3f4a');
    // 진열칸(아래)
    R(0, sceneB, W, H - sceneB, '#3a2e44');
    R(0, sceneB, W, 2, '#2a2033');
    R(0, sceneB + 56, W, 2, '#2a2033');
    return c;
  }

  function skyColor() {
    const p = G.t / SHIFT;       // 0=22시, 1=6시
    if (p < 0.72) return '#141a3a';
    if (p < 0.88) return mixHex('#141a3a', '#4a5a9a', (p - 0.72) / 0.16);
    return mixHex('#4a5a9a', '#f7a26b', clamp((p - 0.88) / 0.12, 0, 1));
  }

  function drawStoreScene() {
    if (!bgCache) bgCache = buildBg();
    b.drawImage(bgCache, 0, 0);
    // 창밖 하늘
    rect(6, 26, 40, 38, skyColor());
    if (G.t / SHIFT < 0.85) {
      const tw = Math.floor(G.anim * 2) % 2;
      [[10, 30], [22, 35], [36, 29], [15, 44], [41, 40], [28, 50]].forEach(([x, y], i) => {
        if ((i + tw) % 3) rect(x, y, 1, 1, '#fff7c2');
      });
      rect(34, 46, 6, 6, '#fff3b0'); rect(36, 46, 4, 4, skyColor()); // 초승달
    } else {
      rect(18, 58, 12, 6, '#ffd27a');
    }
    // 길 건너 건물
    rect(6, 54, 10, 10, '#0d1028'); rect(30, 50, 16, 14, '#0d1028');
    rect(8, 57, 2, 2, '#ffe28a'); rect(33, 54, 2, 2, '#ffe28a'); rect(39, 58, 2, 2, '#ffe28a');
    rect(25, 26, 1, 38, '#5b5466'); rect(6, 44, 40, 1, '#5b5466');
    // 자동문(열림 정도 G.door)
    const open = Math.round(G.door * 11);
    rect(116, 28, 24, counterTop - 28, '#2a3350');
    rect(116 - open, 28, 12, counterTop - 28, '#a9d8f0aa');
    rect(128 + open, 28, 12, counterTop - 28, '#a9d8f0aa');
    rect(119 - open, 32, 1, 18, '#ffffff99');
    rect(131 + open, 32, 1, 18, '#ffffff99');
    rect(114, 26, 2, counterTop - 26, '#8a93a0');
    rect(140, 26, 2, counterTop - 26, '#8a93a0');
    rect(114, 26, 28, 2, '#8a93a0');
  }

  // ───────── 손님 ─────────
  function rnd(a, c) { return a + Math.random() * (c - a); }

  function difficulty() {
    const p = clamp(G.t / SHIFT, 0, 1);
    return {
      spawnGap: lerp(6, 1.6, p),
      minUnits: 1 + Math.floor(G.t / 45),
      maxUnits: Math.min(6, 2 + Math.floor(G.t / 22)),
      patienceMul: lerp(1.3, 0.62, p),
      linePatience: lerp(13, 6, p),
    };
  }

  function spawnCustomer() {
    const d = difficulty();
    let kind = 'normal';
    if (G.t > 20) {
      const r = Math.random();
      if (r < 0.15) kind = 'rush';
      else if (r < 0.25) kind = 'regular';
    }
    const c = {
      kind, sprites: makeCustomerSprites(kind), x: DOOR_X, tx: DOOR_X, face: 'normal',
      walkT: 0, order: null, linePatience: d.linePatience * (kind === 'rush' ? 0.7 : kind === 'regular' ? 1.3 : 1),
      lineMax: 0, leaving: false, happy: false, fade: 1, bubbleIn: 0,
    };
    c.lineMax = c.linePatience;
    Sound.door();
    if (G.queue.length >= SLOTS.length) {
      // 줄이 꽉 참 → 그냥 나감
      c.face = 'angry';
      c.leaving = true;
      c.tx = DOOR_X + 30;
      c.x = DOOR_X;
      G.leaving.push(c);
      loseHeart('줄이 너무 길어요!');
      return;
    }
    G.queue.push(c);
    retarget();
  }

  function retarget() {
    G.queue.forEach((c, i) => { c.tx = SLOTS[i]; });
  }

  function makeOrder(c) {
    const d = difficulty();
    const n = Math.floor(rnd(d.minUnits, d.maxUnits + 1));
    const avail = ITEM_DEFS.slice(0, G.unlocked).map(x => x.id);
    const items = [];
    for (let i = 0; i < n; i++) {
      if (items.length && Math.random() < 0.35) items.push(items[items.length - 1]);
      else items.push(avail[Math.floor(Math.random() * avail.length)]);
    }
    const orderIdx = id => ITEM_DEFS.findIndex(x => x.id === id);
    items.sort((a, z) => orderIdx(a) - orderIdx(z));
    const kindMul = c.kind === 'rush' ? 0.65 : c.kind === 'regular' ? 1.4 : 1;
    const max = (3.5 + 1.1 * n) * d.patienceMul * kindMul;
    c.order = { items, got: items.map(() => false), patience: max, max, flawless: true };
    c.bubbleIn = 0;
  }

  function leave(c, happy) {
    c.leaving = true;
    c.happy = happy;
    c.face = happy ? 'happy' : 'angry';
    c.tx = DOOR_X + 30;
    G.queue.splice(G.queue.indexOf(c), 1);
    G.leaving.push(c);
    retarget();
  }

  function loseHeart(msg) {
    G.hearts = Math.max(0, G.hearts - 1);
    G.lost++;
    G.combo = 0;
    G.shake = 0.35;
    Sound.angry();
    showBanner(msg, '#ff6b6b');
    if (G.hearts <= 0) endGame(false);
  }

  function showBanner(msg, color = '#ffd84d', dur = 1.6) {
    G.banner = { msg, color, t: dur, dur };
  }

  // ───────── 상품 누르기 ─────────
  function tapItem(id) {
    if (G.state !== 'play') return;
    const btn = shelfBtns.find(s => s.id === id);
    const idx = ITEM_DEFS.findIndex(x => x.id === id);
    if (idx >= G.unlocked) return;
    const c = G.queue[0];
    if (!c || !c.order) { Sound.beep(); return; }
    const o = c.order;
    const i = o.items.findIndex((it, k) => it === id && !o.got[k]);
    if (i < 0) {
      // 틀린 상품
      o.flawless = false;
      o.patience = Math.max(0.01, o.patience - 2);
      G.combo = 0;
      G.flash[id] = 0.3;
      G.shake = Math.max(G.shake, 0.15);
      Sound.wrong();
      const bp = bubblePos(c);
      G.floaters.push({ text: '그거 아니에요!', x: bp.cx, y: bp.y - 6, life: 0.9, color: '#ff6b6b', size: 7 });
      return;
    }
    o.got[i] = true;
    Sound.beep();
    const slot = bubbleSlot(c, i);
    G.fly.push({ id, x0: btn.x + 2, y0: btn.y + 4, x1: slot.x, y1: slot.y, t: 0, dur: 0.18 });
    if (o.got.every(Boolean)) completeOrder(c);
  }

  function completeOrder(c) {
    const o = c.order;
    const n = o.items.length;
    if (o.flawless) G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const mult = 1 + Math.min(G.combo, 10) * 0.1;
    const ratio = clamp(o.patience / o.max, 0, 1);
    const kindMul = c.kind === 'rush' ? 1.5 : 1;
    const pts = Math.round((n * 10 + Math.round(ratio * n * 6)) * mult * kindMul);
    G.score += pts;
    G.served++;
    const bp = bubblePos(c);
    G.floaters.push({ text: '+' + pts, x: bp.cx, y: bp.y - 4, life: 1, color: '#ffd84d', size: 9, bold: true });
    for (let k = 0; k < 6; k++) {
      G.coins.push({ x: bp.cx, y: bp.y + 6, vx: rnd(-40, 40), vy: rnd(-70, -30), life: 0.8 });
    }
    Sound.done();
    if (G.combo > 0 && G.combo % 8 === 0 && G.hearts < MAX_HEARTS) {
      G.hearts++;
      Sound.bonus();
      showBanner('사장님 칭찬! ♥ +1', '#ff8fc8');
    } else if (G.combo >= 3 && G.combo % 5 === 0) {
      showBanner(G.combo + '연속 완벽!', '#7de0c6', 1.1);
    }
    leave(c, true);
  }

  function bubblePos(c) {
    const n = c.order ? c.order.items.length : 1;
    const w = n * 15 + 5;
    const h = 24;
    const cx = c.x;
    const x = clamp(Math.round(cx - w / 2), 2, W - w - 2);
    const y = counterTop - 40 - 6 - h;
    return { x, y, w, h, cx: x + w / 2 };
  }
  function bubbleSlot(c, i) {
    const bp = bubblePos(c);
    return { x: bp.x + 3 + i * 15, y: bp.y + 3 };
  }

  // ───────── 진행 ─────────
  function startGame() {
    if (window.Ranking) Ranking.close();
    G.round++;
    Object.assign(G, {
      state: 'play', t: 0, score: 0, hearts: MAX_HEARTS, combo: 0, bestCombo: 0, served: 0, lost: 0,
      queue: [], leaving: [], spawnT: 1, unlocked: 4, fly: [], floaters: [], coins: [],
      banner: null, shake: 0, flash: {}, newBest: false, cleared: false, endT: 0,
    });
    showBanner('밤 10시, 근무 시작!', '#7de0c6', 1.4);
  }

  function endGame(cleared) {
    if (G.state !== 'play') return;
    G.cleared = cleared;
    if (cleared) {
      const bonus = G.hearts * 100;
      G.score += bonus;
      G.clearBonus = bonus;
      Sound.clear();
    } else {
      G.clearBonus = 0;
      Sound.over();
    }
    if (G.score > G.best) {
      G.best = G.score;
      G.newBest = true;
      store.set('pixelmart.best', String(G.best));
    }
    G.state = 'over';
    G.endT = 0;
  }

  function update(dt) {
    G.anim += dt;
    G.shake = Math.max(0, G.shake - dt);
    for (const k in G.flash) { G.flash[k] -= dt; if (G.flash[k] <= 0) delete G.flash[k]; }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }

    G.floaters = G.floaters.filter(f => { f.life -= dt; f.y -= 14 * dt; return f.life > 0; });
    G.coins = G.coins.filter(p => { p.life -= dt; p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0; });
    G.fly = G.fly.filter(f => { f.t += dt; return f.t < f.dur; });

    // 걷기
    const moving = [...G.queue, ...G.leaving];
    for (const c of moving) {
      const sp = c.leaving ? 60 : 45;
      if (Math.abs(c.tx - c.x) > 0.5) {
        c.x += Math.sign(c.tx - c.x) * Math.min(sp * dt, Math.abs(c.tx - c.x));
        c.walkT += dt;
      } else {
        c.x = c.tx;
      }
      if (c.leaving && c.x > DOOR_X + 4) c.fade -= dt * 4;
    }
    G.leaving = G.leaving.filter(c => c.fade > 0);
    const nearDoor = moving.some(c => c.x > 112 && (Math.abs(c.tx - c.x) > 0.5 || c.leaving));
    G.door = clamp(G.door + (nearDoor ? 4 : -3) * dt, 0, 1);

    if (G.state === 'over') { G.endT += dt; return; }
    if (G.state !== 'play') return;

    G.t += dt;
    if (G.t >= SHIFT) { endGame(true); return; }

    const before = G.unlocked;
    G.unlocked = UNLOCK_AT.filter(s => G.t >= s).length;
    if (G.unlocked > before) {
      showBanner('신상품 입고: ' + ITEM_DEFS[G.unlocked - 1].name + '!', '#ffd84d', 1.8);
      Sound.bonus();
    }

    // 손님 등장
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      spawnCustomer();
      if (G.state !== 'play') return;
      const d = difficulty();
      G.spawnT = d.spawnGap * rnd(0.8, 1.2);
    }

    // 인내심
    G.queue.slice().forEach((c, i) => {
      const atSlot = Math.abs(c.x - c.tx) < 0.5;
      if (i === 0 && atSlot) {
        if (!c.order) makeOrder(c);
        c.bubbleIn = Math.min(1, c.bubbleIn + dt * 6);
        c.order.patience -= dt;
        if (c.order.patience <= 0) {
          leave(c, false);
          loseHeart('손님이 화났어요!');
        }
      } else if (i > 0) {
        c.linePatience -= dt;
        if (c.linePatience <= 0) {
          leave(c, false);
          loseHeart('기다리다 지쳤어요!');
        }
      }
    });
  }

  // ───────── 그리기 ─────────
  function drawCustomer(c) {
    const img = c.sprites[c.face] || c.sprites.normal;
    const moving = Math.abs(c.tx - c.x) > 0.5;
    let bob = 0;
    if (moving) bob = Math.floor(c.walkT * 8) % 2;
    else if (c.happy) bob = Math.floor(G.anim * 10) % 2 * -2;
    else bob = Math.floor(G.anim * 2 + c.x) % 2;
    b.globalAlpha = clamp(c.fade, 0, 1);
    spr(img, c.x - 16, counterTop - 40 + bob, 2);
    // 표정 아이콘
    const order = c.order;
    const worried = (order && order.patience / order.max < 0.3) || (!order && c.lineMax && c.linePatience / c.lineMax < 0.3);
    if (c.kind === 'rush' || worried) {
      if (Math.floor(G.anim * 3) % 2 === 0 || c.kind === 'rush') spr(ICONS.sweat, c.x + 11, counterTop - 36 + bob, 2);
    }
    if (c.face === 'angry') spr(ICONS.anger, c.x + 9, counterTop - 44 + bob, 2);
    b.globalAlpha = 1;
    // 줄 선 손님 인내심 막대
    if (!c.leaving && G.queue.indexOf(c) > 0) {
      const p = clamp(c.linePatience / c.lineMax, 0, 1);
      rect(c.x - 7, counterTop - 47, 14, 3, OUTLINE);
      rect(c.x - 6, counterTop - 46, Math.max(1, Math.round(12 * p)), 1, p > 0.5 ? '#3ddc6a' : p > 0.25 ? '#ffd84d' : '#ff4d5e');
    }
  }

  function drawBubble(c) {
    const o = c.order;
    if (!o) return;
    const bp = bubblePos(c);
    const pop = c.bubbleIn < 1 ? Math.round((1 - c.bubbleIn) * 4) : 0;
    const y = bp.y + pop;
    box(bp.x, y, bp.w, bp.h, '#ffffff', OUTLINE, '#00000040');
    // 꼬리
    const tx = clamp(Math.round(c.x) - 2, bp.x + 3, bp.x + bp.w - 7);
    rect(tx, y + bp.h - 1, 5, 1, '#ffffff');
    rect(tx, y + bp.h, 1, 3, OUTLINE); rect(tx + 4, y + bp.h, 1, 1, OUTLINE);
    rect(tx + 1, y + bp.h, 3, 1, '#ffffff'); rect(tx + 1, y + bp.h + 1, 2, 1, '#ffffff');
    rect(tx + 3, y + bp.h + 1, 1, 1, OUTLINE); rect(tx + 1, y + bp.h + 2, 2, 1, OUTLINE);
    o.items.forEach((id, i) => {
      const sx2 = bp.x + 3 + i * 15;
      if (o.got[i]) {
        b.globalAlpha = 0.3;
        spr(ITEM_SPRITES[id], sx2, y + 3);
        b.globalAlpha = 1;
        spr(ICONS.check, sx2 + 2, y + 5);
      } else {
        spr(ITEM_SPRITES[id], sx2, y + 3);
      }
    });
    // 인내심 막대
    const p = clamp(o.patience / o.max, 0, 1);
    const bw = bp.w - 6;
    rect(bp.x + 3, y + bp.h - 4, bw, 2, '#e6e0d6');
    const col = p > 0.5 ? '#3ddc6a' : p > 0.25 ? '#ffd84d' : '#ff4d5e';
    if (p > 0.25 || Math.floor(G.anim * 6) % 2 === 0) rect(bp.x + 3, y + bp.h - 4, Math.max(1, Math.round(bw * p)), 2, col);
  }

  function drawShelf() {
    const c = G.queue[0];
    const needed = new Set();
    if (c && c.order) c.order.items.forEach((id, i) => { if (!c.order.got[i]) needed.add(id); });
    const tutorial = G.state === 'play' && G.served === 0 && G.t < 40;
    for (const s of shelfBtns) {
      const locked = s.idx >= G.unlocked && G.state !== 'title';
      const pressed = G.pressed === s.id && G.pressT > 0;
      const flash = G.flash[s.id];
      const py = s.y + (pressed ? 1 : 0);
      let fill = '#f6efe0';
      if (locked) fill = '#4b405a';
      else if (flash) fill = '#ff9a9a';
      box(s.x, py, s.w, s.h, fill, OUTLINE, pressed ? null : '#1b1626');
      if (!locked) {
        rect(s.x + 2, py + 2, s.w - 4, 1, '#ffffff');
        rect(s.x + 1, py + s.h - 11, s.w - 2, 1, '#d9cdb5');
        rect(s.x + 1, py + s.h - 10, s.w - 2, 9, '#ffe9a8');
        spr(ITEM_SPRITES[s.id], s.x + 2, py + 3, 2);
        if (tutorial && needed.has(s.id) && Math.floor(G.anim * 4) % 2 === 0) {
          b.strokeStyle = '#ff4d5e';
          b.lineWidth = 1;
          b.strokeRect(s.x - 0.5, py - 0.5, s.w + 1, s.h + 1);
        }
        text(ITEM_DEFS[s.idx].name, s.x + s.w / 2, py + s.h - 5.5, 6.5, '#3a2e44', 'center', { maxW: s.w - 3, bold: true });
      } else {
        spr(ICONS.lock, s.x + s.w / 2 - 3, py + 14);
        text('입고 예정', s.x + s.w / 2, py + s.h - 9, 6, '#a99cbc', 'center', { maxW: s.w - 4 });
      }
    }
  }

  function clockText() {
    const m = 22 * 60 + Math.floor(clamp(G.t / SHIFT, 0, 1) * 480 / 10) * 10;
    const hh = Math.floor(m / 60) % 24, mm = m % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function drawHud() {
    rect(0, 0, W, 14, '#1b1626');
    spr(ICONS.coin, 3, 3);
    text(G.score.toLocaleString('ko-KR'), 12, 7.5, 7.5, '#ffd84d', 'left', { bold: true });
    text(clockText(), 72, 7.5, 8, '#ffffff', 'center', { bold: true });
    for (let i = 0; i < MAX_HEARTS; i++) spr(i < G.hearts ? ICONS.heart : ICONS.heartEmpty, 100 + i * 10, 3);
    // 일시정지 버튼
    box(131, 2, 11, 10, '#4b405a');
    rect(134, 4, 2, 6, '#fff'); rect(137, 4, 2, 6, '#fff');
    uiBtns.push({ x: 128, y: 0, w: 16, h: 14, act: pauseGame });
    // 근무 진행 막대
    const p = clamp(G.t / SHIFT, 0, 1);
    rect(0, 13, W, 1, '#3a2e44');
    rect(0, 13, Math.round(W * p), 1, '#7de0c6');
  }

  function drawBanner() {
    if (!G.banner) return;
    const a = clamp(G.banner.t / 0.25, 0, 1);
    const y = 34;
    b.globalAlpha = a;
    box(14, y - 8, W - 28, 16, '#1b1626', '#fff');
    b.globalAlpha = 1;
    text(G.banner.msg, W / 2, y, 8, G.banner.color, 'center', { bold: true, alpha: a, maxW: W - 34 });
  }

  function drawFx() {
    for (const f of G.fly) {
      const p = f.t / f.dur;
      const x = lerp(f.x0, f.x1, p), y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * 12;
      spr(ITEM_SPRITES[f.id], x, y);
    }
    for (const p of G.coins) spr(ICONS.coin, p.x, p.y);
    for (const f of G.floaters) {
      text(f.text, f.x, f.y, f.size, f.color, 'center', { bold: true, stroke: OUTLINE, strokeW: 2, alpha: clamp(f.life * 2, 0, 1) });
    }
  }

  function button(x, y, w, h, label, act, fill = '#ffd84d', color = '#3a2e44', size = 9) {
    box(x, y, w, h, fill, OUTLINE, '#00000066');
    rect(x + 2, y + 2, w - 4, 1, '#ffffff88');
    text(label, x + w / 2, y + h / 2 + 0.5, size, color, 'center', { bold: true, maxW: w - 6 });
    uiBtns.push({ x, y, w, h, act });
  }

  function drawTitle() {
    // 밤하늘
    rect(0, 0, W, H, '#141a3a');
    const tw = Math.floor(G.anim * 1.5);
    for (let i = 0; i < 30; i++) {
      const x = (i * 53) % W, y = (i * 37) % 90 + 4;
      if ((i + tw) % 4) rect(x, y, 1, 1, '#fff7c2');
    }
    rect(114, 12, 6, 12, '#fff3b0'); rect(112, 14, 10, 8, '#fff3b0'); rect(116, 12, 7, 9, '#141a3a'); rect(118, 14, 5, 8, '#141a3a');
    // 건물
    const gy = H - 112;  // 땅
    rect(0, gy, W, H - gy, '#2a2238');
    rect(0, gy, W, 2, '#4b405a');
    rect(14, gy - 96, 116, 96, '#efe6d4');
    rect(14, gy - 96, 116, 2, '#d6c9ae');
    // 간판
    box(10, gy - 104, 124, 24, '#26a69a', OUTLINE);
    rect(12, gy - 102, 120, 2, '#7de0c6');
    // 가게 유리창(밝음)
    rect(20, gy - 70, 70, 52, '#5b5466');
    rect(22, gy - 68, 66, 48, '#fff6c9');
    rect(22, gy - 68, 66, 4, '#ffffff');
    for (let y = gy - 58; y < gy - 22; y += 10) {
      rect(24, y + 7, 62, 2, '#c9b48f');
      for (let x = 26, k = y; x < 84; x += 5, k += 3) rect(x, y + 2, 3, 5, ['#e2453c', '#4f8cff', '#46c47e', '#f5c542', '#f48fb1', '#f08a24'][k % 6]);
    }
    rect(55, gy - 68, 1, 48, '#5b5466');
    // 문
    rect(96, gy - 70, 28, 70, '#5b5466');
    rect(98, gy - 68, 24, 68, '#a9d8f0');
    rect(109, gy - 68, 2, 68, '#5b5466');
    rect(101, gy - 64, 1, 20, '#ffffffaa'); rect(113, gy - 64, 1, 20, '#ffffffaa');
    // 바닥 빛
    b.globalAlpha = 0.25;
    rect(18, gy, 108, 6, '#fff6c9');
    b.globalAlpha = 1;
    // 알바생(나)
    if (!G.titleClerk) G.titleClerk = bakeCustomer({ skin: '#ffd9b8', hair: '#2b2230', shirt: '#26a69a', pants: '#2b3a55', cap: '#26a69a', style: 'cap', glasses: false }, 'happy');
    spr(G.titleClerk, 64, gy - 22 + (Math.floor(G.anim * 2) % 2));

    text('픽셀편의점', W / 2, gy - 92, 13, '#ffffff', 'center', { bold: true, stroke: '#1b7f76', strokeW: 3 });
    text('24시 야간 알바', 112, gy - 82.5, 5.5, '#ffd84d', 'center', { bold: true });

    const by = gy + 14;
    button(22, by, 100, 22, '알바 시작', startGame, '#ffd84d', '#3a2e44', 11);
    text('손님 말풍선 속 상품을 아래 버튼으로 눌러요', W / 2, by + 34, 6, '#e8e0f0', 'center', { maxW: W - 10 });
    text('밤 10시부터 아침 6시까지 버티면 퇴근!', W / 2, by + 44, 6, '#e8e0f0', 'center', { maxW: W - 10 });
    text('최고 매출  ' + G.best.toLocaleString('ko-KR'), W / 2, by + 58, 7, '#ffd84d', 'center', { bold: true });
    if (window.Ranking && Ranking.enabled) {
      button(14, by + 68, 56, 14, '전체 순위', () => Ranking.open(), '#7de0c6', '#1b4f4a', 7);
      button(74, by + 68, 56, 14, Sound.muted ? '소리 끔' : '소리 켬', () => { Sound.toggle(); }, '#4b405a', '#ffffff', 7);
    } else {
      button(44, by + 68, 56, 14, Sound.muted ? '소리 끔' : '소리 켬', () => { Sound.toggle(); }, '#4b405a', '#ffffff', 7);
    }
    text('개인정보처리방침', W / 2, by + 90, 5.5, '#8a7f98', 'center');
    uiBtns.push({ x: W / 2 - 25, y: by + 85, w: 50, h: 10, act: () => { location.href = 'privacy.html'; } });
  }

  function rankTitle(score) {
    if (score < 800) return '수습 알바';
    if (score < 1800) return '야간 알바';
    if (score < 3000) return '베테랑 알바';
    if (score < 4200) return '부점장';
    return '전설의 점장';
  }

  function drawOver() {
    const a = clamp(G.endT / 0.4, 0, 1);
    b.globalAlpha = 0.7 * a;
    rect(0, 0, W, H, '#0d0a14');
    b.globalAlpha = 1;
    if (G.endT < 0.3) return;
    const rk = window.Ranking && Ranking.enabled;
    const pw = 124, ph = rk ? 172 : 150, px = (W - pw) / 2, py = Math.max(18, (H - ph) / 2 - 10);
    box(px, py, pw, ph, '#f6efe0', OUTLINE, '#000');
    rect(px + 1, py + 1, pw - 2, 22, G.cleared ? '#26a69a' : '#e2453c');
    text(G.cleared ? '퇴근 성공!' : '오늘 근무 끝…', W / 2, py + 12.5, 11, '#fff', 'center', { bold: true });
    const rows = [
      ['오늘 매출', G.score.toLocaleString('ko-KR')],
      ['받은 손님', G.served + '명'],
      ['최고 연속', G.bestCombo + '번'],
    ];
    if (G.cleared) rows.push(['퇴근 보너스', '+' + G.clearBonus]);
    else rows.push(['근무 시간', clockText() + '까지']);
    rows.forEach(([k, v], i) => {
      const y = py + 34 + i * 13;
      text(k, px + 10, y, 7, '#6b5f7a', 'left');
      text(v, px + pw - 10, y, 7.5, '#3a2e44', 'right', { bold: true });
    });
    const ry = py + 34 + rows.length * 13 + 4;
    rect(px + 8, ry - 4, pw - 16, 1, '#d9cdb5');
    text('칭호: ' + rankTitle(G.score), W / 2, ry + 5, 8, '#26a69a', 'center', { bold: true });
    text((G.newBest ? '새 기록! ' : '최고 매출 ') + G.best.toLocaleString('ko-KR'), W / 2, ry + 17, 7, G.newBest ? '#e2453c' : '#6b5f7a', 'center', { bold: G.newBest });
    if (rk) {
      const done = Ranking.alreadySubmitted(G.round);
      const label = G.score > 0 && !done ? '전체 순위에 올리기' : '전체 순위 보기';
      button(px + 8, py + ph - 48, pw - 16, 18, label, () => Ranking.open({ round: G.round, score: G.score }), '#7de0c6', '#1b4f4a', 8);
    }
    button(px + 8, py + ph - 26, 58, 18, '다시 하기', startGame, '#ffd84d', '#3a2e44', 8);
    button(px + 70, py + ph - 26, 46, 18, '처음으로', () => { G.state = 'title'; G.queue = []; G.leaving = []; }, '#4b405a', '#fff', 7);
  }

  function pauseGame() {
    if (G.state === 'play') G.state = 'pause';
  }

  function drawPause() {
    b.globalAlpha = 0.7;
    rect(0, 0, W, H, '#0d0a14');
    b.globalAlpha = 1;
    const pw = 110, ph = 96, px = (W - pw) / 2, py = (H - ph) / 2 - 20;
    box(px, py, pw, ph, '#f6efe0', OUTLINE, '#000');
    text('잠깐 쉬는 중', W / 2, py + 12, 9, '#3a2e44', 'center', { bold: true });
    button(px + 10, py + 24, pw - 20, 18, '계속하기', () => { G.state = 'play'; }, '#ffd84d', '#3a2e44', 8);
    button(px + 10, py + 46, pw - 20, 16, Sound.muted ? '소리 켜기' : '소리 끄기', () => { Sound.toggle(); }, '#4b405a', '#fff', 7);
    button(px + 10, py + 66, pw - 20, 16, '그만하기', () => { G.state = 'title'; G.queue = []; G.leaving = []; }, '#e2453c', '#fff', 7);
  }

  function render() {
    uiBtns = [];
    b.imageSmoothingEnabled = false;
    b.clearRect(0, 0, W, H);
    if (G.state === 'title') {
      drawTitle();
    } else {
      drawStoreScene();
      const list = [...G.leaving, ...G.queue].sort((p, q) => q.x - p.x);
      list.forEach(drawCustomer);
      // 계산대(손님 하반신 가리기)
      b.drawImage(bgCache, 0, counterTop, W, sceneB - counterTop, 0, counterTop, W, sceneB - counterTop);
      if (G.queue[0]) drawBubble(G.queue[0]);
      if (G.combo >= 2 && G.state === 'play') {
        text('콤보 ×' + G.combo, W / 2, counterTop + 15, 7.5, '#ff8fc8', 'center', { bold: true, stroke: OUTLINE, strokeW: 2 });
      }
      if (G.state === 'play' && G.served === 0 && G.combo < 2 && G.t < 40 && G.queue[0] && G.queue[0].order) {
        text('말풍선 속 상품을 아래에서 눌러요!', W / 2, counterTop + 15, 6.5, '#ffffff', 'center', { bold: true, maxW: W - 8 });
      }
      drawShelf();
      drawHud();
    }
    const sh = G.shake > 0 ? (Math.random() < 0.5 ? -1 : 1) * Math.ceil(G.shake * 6) : 0;
    offX = sh; offY = 0;
    blit(true);
    if (G.state !== 'title') {
      // 위층: 효과·알림·창(아래층 글자 위에 덮어야 함)
      b.clearRect(0, 0, W, H);
      drawFx();
      drawBanner();
      if (G.state === 'pause') drawPause();
      if (G.state === 'over') drawOver();
      blit(false);
    }
  }

  function blit(clearBg) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    if (clearBg) {
      sctx.fillStyle = '#1b1626';
      sctx.fillRect(0, 0, screen.width, screen.height);
    }
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(buf, offX * sx, offY * sx, W * sx, H * sx);
    flushTexts();
  }

  // ───────── 입력 ─────────
  function toLogical(e) {
    const r = screen.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  const inside = (p, q) => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.h;

  screen.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = toLogical(e);
    for (const u of uiBtns.slice().reverse()) {
      if (inside(p, u)) { u.act(); return; }
    }
    if (G.state === 'play') {
      const s = shelfBtns.find(q => inside(p, { x: q.x - 1, y: q.y - 1, w: q.w + 2, h: q.h + 3 }));
      if (s) {
        G.pressed = s.id; G.pressT = 0.08;
        tapItem(s.id);
      }
    }
  });
  window.addEventListener('keydown', (e) => {
    if (window.Ranking && Ranking.isOpen) return;
    if (G.state === 'play') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 8) tapItem(ITEM_DEFS[n - 1].id);
      if (e.key === 'Escape' || e.key === 'p') pauseGame();
    } else if ((G.state === 'title' || G.state === 'over') && (e.key === 'Enter' || e.key === ' ')) {
      startGame();
    } else if (G.state === 'pause' && (e.key === 'Escape' || e.key === 'p')) {
      G.state = 'play';
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('resize', layout);

  // ───────── 반복 ─────────
  let last = performance.now();
  let manual = false;   // 테스트용
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!manual) {
      if (G.pressT > 0) G.pressT -= dt;
      update(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  async function boot() {
    buildItemSprites();
    buildIcons();
    layout();
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`400 10px ${FONT}`), document.fonts.load(`700 10px ${FONT}`)]),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    } catch (e) { /* 글꼴 없이 진행 */ }
    requestAnimationFrame(frame);
  }

  // 자동 점검용(게임에는 영향 없음)
  window.__pm = {
    G, startGame, tapItem, update,
    setManual(v) { manual = v; },
    step(sec, h = 1 / 60) { for (let t = 0; t < sec; t += h) update(h); },
  };

  boot();
})();
