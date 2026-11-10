// 픽셀 그림: 글자 지도(문자 하나 = 픽셀 하나)를 작은 캔버스로 굽는다.
'use strict';

const OUTLINE = '#1b1626';

// rows: 문자열 배열, pal: { 문자: 색 }, '.'은 투명. outline=true면 둘레에 1px 테두리.
function bakeSprite(rows, pal, outline = true) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const pad = outline ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d');
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] && rows[y][x] !== '.' && rows[y][x] !== ' ';
  if (outline) {
    g.fillStyle = OUTLINE;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          g.fillRect(x + pad, y + pad, 1, 1);
        }
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (!filled(x, y)) continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x + pad, y + pad, 1, 1);
    }
  }
  return c;
}

// ───────── 상품 ─────────
const ITEM_DEFS = [
  {
    id: 'kimbap', name: '삼각김밥',
    pal: { W: '#f7f4ea', w: '#d9d3c2', N: '#24303a', n: '#3a4a56', R: '#e2453c' },
    rows: [
      '.....WW.....',
      '....WWWW....',
      '....WWWw....',
      '...WWWWWw...',
      '...WWWWWw...',
      '..WWWWWWWw..',
      '..WWNNNNWw..',
      '.WWNNNNNNWw.',
      '.WNNNRRNNNW.',
      'WNNNnRRnNNNW',
      'NNNNNNNNNNNN',
    ],
  },
  {
    id: 'ramen', name: '컵라면',
    pal: { L: '#e8e4dc', l: '#bdb7ab', R: '#e2453c', r: '#a8312c', W: '#fbf6ec', Y: '#f5c542' },
    rows: [
      'LLLLLLLLLLLL',
      'lLLLLLLLLLLl',
      '.RRRRRRRRRR.',
      '.RRRRRRRRRr.',
      '.RWWWWWWWWr.',
      '..WWYYYYWW..',
      '..WWWWWWWW..',
      '..RRRRRRRr..',
      '..RRRRRRRr..',
      '...RRRRRr...',
      '...rrrrrr...',
    ],
  },
  {
    id: 'milk', name: '딸기우유',
    pal: { P: '#f48fb1', p: '#d26a8f', W: '#fff7fb', R: '#e2453c', G: '#5bbf6a' },
    rows: [
      '.....PP.....',
      '....PPPp....',
      '...PPPPPp...',
      '..PPPPPPPp..',
      '..WWWWWWWW..',
      '..WPPGGPPW..',
      '..WPRRRRpW..',
      '..WPRRRRpW..',
      '..WPPRRPpW..',
      '..WPPPPPpW..',
      '..WWWWWWWW..',
      '..pppppppp..',
    ],
  },
  {
    id: 'water', name: '생수',
    pal: { B: '#2f7de1', b: '#1f5bb0', L: '#bfe6ff', l: '#8cc8f0', W: '#ffffff' },
    rows: [
      '.....BB.....',
      '.....Bb.....',
      '....LLLL....',
      '...LLLLLl...',
      '...LWLLLl...',
      '...BBBBBb...',
      '...BWWWBb...',
      '...BBBBBb...',
      '...LWLLLl...',
      '...LLLLLl...',
      '...LLLLLl...',
      '....llll....',
    ],
  },
  {
    id: 'lunch', name: '도시락',
    pal: { K: '#3b2f2f', W: '#fbf6ec', Y: '#f5c542', R: '#e2453c', G: '#5bbf6a', O: '#e8873a', L: '#d6eef6' },
    rows: [
      'LLLLLLLLLLLL',
      'KKKKKKKKKKKK',
      'KWWWWKYYYRRK',
      'KWWWWKYYYRRK',
      'KWWRWKGGOOOK',
      'KWWWWKGGOOOK',
      'KWWWWKGGOOOK',
      'KKKKKKKKKKKK',
    ],
  },
  {
    id: 'snack', name: '과자',
    pal: { O: '#f08a24', o: '#c56a14', Y: '#ffd84d', y: '#e0b52f', R: '#e2453c' },
    rows: [
      '..oOoOoOoO..',
      '..OOOOOOOO..',
      '.OOOOOOOOOo.',
      '.OORRRRRROo.',
      '.OOOOOOOOOo.',
      '.OOYYYYYyOo.',
      '.OYYYYYYyyo.',
      '.OOYYYYyyOo.',
      '.OOOOOOOOOo.',
      '..OOOOOOOO..',
      '..oOoOoOoO..',
    ],
  },
  {
    id: 'icecream', name: '아이스크림',
    pal: { P: '#ff9fc4', p: '#e27aa3', W: '#ffffff', T: '#e0a85c', t: '#a8742f', C: '#6b3e22' },
    rows: [
      '....PPPP....',
      '...PPWPPP...',
      '..PPWPPPPp..',
      '..PPPPCPPp..',
      '..PpPPPpPp..',
      '..TTTTTTTT..',
      '...TtTTtT...',
      '...TTtTtT...',
      '....TtTt....',
      '....TTt.....',
      '.....t......',
    ],
  },
  {
    id: 'coffee', name: '캔커피',
    pal: { S: '#d7dde2', s: '#9aa5ae', N: '#7a4a2b', n: '#53301a', W: '#f6e7cc', Y: '#f5c542' },
    rows: [
      '....SSSs....',
      '...SSSSSs...',
      '...NNNNNn...',
      '...NNNNNn...',
      '...WWWWWW...',
      '...WYYWWW...',
      '...WWWWWW...',
      '...NNNNNn...',
      '...NNNNNn...',
      '...NNNNNn...',
      '...SSSSSs...',
    ],
  },
];

const ITEM_SPRITES = {};
function buildItemSprites() {
  for (const d of ITEM_DEFS) ITEM_SPRITES[d.id] = bakeSprite(d.rows, d.pal);
}

// ───────── 작은 아이콘 ─────────
const ICONS = {};
function buildIcons() {
  ICONS.heart = bakeSprite([
    '.RR.RR.',
    'RWRRRRR',
    'RRRRRRR',
    'RRRRRRr',
    '.RRRRr.',
    '..RRr..',
    '...r...',
  ], { R: '#ff4d5e', r: '#c22d3c', W: '#ffd0d6' });
  ICONS.heartEmpty = bakeSprite([
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ], { R: '#4a3f5c' });
  ICONS.check = bakeSprite([
    '.......G',
    '......GG',
    'G....GG.',
    'GG..GG..',
    '.GGGG...',
    '..GG....',
  ], { G: '#3ddc6a' });
  ICONS.coin = bakeSprite([
    '.YYY.',
    'YWYYy',
    'YYYYy',
    'YYYyy',
    '.yyy.',
  ], { Y: '#ffd84d', y: '#d9a520', W: '#fff6c2' });
  ICONS.sweat = bakeSprite([
    '.B.',
    'BBB',
    'BWB',
    '.B.',
  ], { B: '#58b8ff', W: '#e6f6ff' }, false);
  ICONS.anger = bakeSprite([
    'R.R',
    '.R.',
    'R.R',
  ], { R: '#ff3b3b' }, false);
  ICONS.lock = bakeSprite([
    '.KKK.',
    'K...K',
    'K...K',
    'YYYYY',
    'YYKYY',
    'YYKYY',
    'YYYYY',
  ], { K: '#cfc6b8', Y: '#9a8f80' });
  ICONS.bag = bakeSprite([
    '..K..K..',
    '.K....K.',
    'WWWWWWWW',
    'WWWWWWWw',
    'WWGGGWWw',
    'WWWWWWWw',
    'WWWWWWWw',
    'wwwwwwww',
  ], { K: '#9aa5ae', W: '#ffffff', w: '#cfd6dc', G: '#3fbf8f' });
}

// ───────── 손님 ─────────
// 14x24 기본 몸. S 피부, E 눈, M 입, R 볼, C 옷, D 옷 그림자, P 바지
const BODY = [
  '..............',
  '..............',
  '....SSSSSS....',
  '...SSSSSSSS...',
  '..SSSSSSSSSS..',
  '..SSSSSSSSSS..',
  '..SSESSSSESS..',
  '..SSESSSSESS..',
  '..SRSSSSSSRS..',
  '..SSSSMMSSSS..',
  '...SSSSSSSS...',
  '....SSSSSS....',
  '.....SSSS.....',
  '...CCCCCCCC...',
  '..CCCCCCCCCC..',
  '.CCCCCCCCCCCC.',
  '.CCCCCCCCCCCC.',
  '.CCDCCCCCCDCC.',
  '.CCDCCCCCCDCC.',
  '.SSDCCCCCCDSS.',
  '.SS.CCCCCC.SS.',
  '....CCCCCC....',
  '....PPPPPP....',
  '....PP..PP....',
];

// 머리 모양: 겹쳐 그릴 칸. H=머리카락(또는 모자), h=모자 챙
const HAIRS = {
  short: [
    '....HHHHHH....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HHHHHHHHHH..',
    '..HHH....HHH..',
    '..H........H..',
  ],
  long: [
    '....HHHHHH....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '.HHHHHHHHHHHH.',
    '.HHH......HHH.',
    '.HH........HH.',
    '.HH........HH.',
    '.HH........HH.',
    '.HH........HH.',
    '.HH........HH.',
    '.HH........HH.',
    '..H........H..',
  ],
  bun: [
    '.....HHHH.....',
    '....HHHHHH....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HH......HH..',
    '..H........H..',
  ],
  cap: [
    '....KKKKKK....',
    '...KKKKKKKK...',
    '..KKKKKKKKKK..',
    '..KKKKKKKKKK..',
    'kkkkkkkkkk....',
    '..H........H..',
  ],
  spiky: [
    '...H.H.H.H....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HHHHHHHHHH..',
    '..HH.H..H.HH..',
    '..............',
  ],
  gray: [
    '..............',
    '..............',
    '....SSSSSS....',
    '..HHSSSSSSHH..',
    '..HH......HH..',
    '..H........H..',
  ],
};

const SKINS = ['#ffd9b8', '#f2c49b', '#e0a878', '#c98d5f'];
const HAIR_COLORS = ['#2b2230', '#4a3326', '#7a4e2d', '#c9772e', '#5b4a8a', '#d9c36a'];
const SHIRTS = ['#4f8cff', '#ff6b6b', '#46c47e', '#ffb347', '#a77bff', '#2ec4c4', '#ff8fc8', '#6d7a8a', '#f2f2f2'];
const PANTS = ['#2b3a55', '#3a3a3a', '#5a4632', '#2d4a3a'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * k)));
  g = Math.max(0, Math.min(255, Math.round(g * k)));
  b = Math.max(0, Math.min(255, Math.round(b * k)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }

// kind: 'normal' | 'rush' | 'regular'
function makeCustomerLook(kind) {
  const look = {
    skin: pick(SKINS),
    hair: pick(HAIR_COLORS),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    cap: pick(SHIRTS),
    style: pick(['short', 'short', 'long', 'bun', 'cap', 'spiky']),
    glasses: Math.random() < 0.2,
  };
  if (kind === 'regular') {
    look.style = 'gray';
    look.hair = '#d8d4cf';
    look.glasses = true;
    look.shirt = pick(['#8a6fb8', '#b85c6f', '#6f9a6a']);
  }
  if (kind === 'rush') {
    look.shirt = '#3a4660'; // 정장
    look.style = pick(['short', 'spiky', 'bun']);
  }
  return look;
}

// face: 'normal' | 'happy' | 'angry'
function bakeCustomer(look, face) {
  const grid = BODY.map(r => r.split(''));
  const hair = HAIRS[look.style];
  for (let y = 0; y < hair.length; y++) {
    for (let x = 0; x < hair[y].length; x++) {
      const ch = hair[y][x];
      if (ch === '.') continue;
      grid[y][x] = ch;
    }
  }
  if (look.glasses) {
    for (const x of [3, 4, 5, 8, 9, 10]) grid[6][x] = 'G';
    grid[6][6] = 'g'; grid[6][7] = 'g';
    grid[6][4] = 'E'; grid[6][9] = 'E';
  }
  if (face === 'happy') {
    // 웃는 눈(^ ^) + 벌린 입
    grid[7][4] = 'S'; grid[7][9] = 'S';
    grid[6][3] = look.glasses ? 'G' : 'E';
    grid[6][5] = look.glasses ? 'G' : 'E';
    grid[6][8] = look.glasses ? 'G' : 'E';
    grid[6][10] = look.glasses ? 'G' : 'E';
    grid[6][4] = 'S'; grid[6][9] = 'S';
    grid[9][5] = 'M'; grid[9][8] = 'M';
    grid[10][6] = 'm'; grid[10][7] = 'm';
  } else if (face === 'angry') {
    grid[5][3] = 'E'; grid[5][4] = 'E'; grid[5][9] = 'E'; grid[5][10] = 'E';
    grid[4][3] = look.style === 'gray' || look.style === 'cap' ? grid[4][3] : grid[4][3];
    grid[9][6] = 'E'; grid[9][7] = 'E';
    grid[9][5] = 'S'; grid[9][8] = 'S';
    grid[8][3] = 'A'; grid[8][10] = 'A';
  }
  const angryTint = face === 'angry';
  const skin = angryTint ? '#ff9a86' : look.skin;
  const pal = {
    S: skin,
    E: '#1b1626',
    M: '#c2413b',
    m: '#ff8a80',
    R: angryTint ? '#ff6b5e' : shade(look.skin, 0.88),
    A: '#e8443a',
    C: look.shirt,
    D: shade(look.shirt, 0.78),
    P: look.pants,
    H: look.hair,
    K: look.cap,
    k: shade(look.cap, 0.75),
    G: '#2b2230',
    g: '#2b2230',
  };
  const rows = grid.map(r => r.join(''));
  return bakeSprite(rows, pal);
}

function makeCustomerSprites(kind) {
  const look = makeCustomerLook(kind);
  return {
    look,
    normal: bakeCustomer(look, 'normal'),
    happy: bakeCustomer(look, 'happy'),
    angry: bakeCustomer(look, 'angry'),
  };
}
