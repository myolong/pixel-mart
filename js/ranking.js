// 전체 순위표: Supabase REST(표 scores)에 닉네임과 점수를 올리고 상위 10명을 보여 준다.
// 점수 범위·닉네임 길이 검사는 서버의 표 제약 조건이 맡는다.
'use strict';

const Ranking = (() => {
  const GAME = 'pixelmart';
  const TOP_N = 10;
  const MAX_NAME = 8;
  const NAME_KEY = 'pixelmart.nickname';

  const BAD_WORDS = [
    '시발', '씨발', '씨빨', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '개색', '새끼', 'ㅅㄲ',
    '좆', '존나', '졸라', 'ㅈㄴ', '지랄', 'ㅈㄹ', '미친', '꺼져', '닥쳐', '엠창', '느금', '니애미', '애미', '애비',
    '섹스', '보지', '자지', '야동', '운영자', '관리자',
    'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'pussy', 'admin',
  ];

  const cfg = window.RANKING_CONFIG || {};
  const base = (cfg.url || '').replace(/\/+$/, '');
  const enabled = Boolean(base && cfg.key);
  const headers = { apikey: cfg.key };

  let modal = null;
  let submittedRound = -1;

  const cleanName = n => n.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  const isBad = n => {
    const flat = n.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
    return BAD_WORDS.some(w => flat.includes(w));
  };
  const loadName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
  const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* 무시 */ } };

  async function fetchTop() {
    const q = `select=name,score&game=eq.${GAME}&order=score.desc,created_at.asc&limit=${TOP_N}`;
    const res = await fetch(`${base}/rest/v1/scores?${q}`, { headers });
    if (!res.ok) throw new Error('load ' + res.status);
    return res.json();
  }

  async function submit(name, score) {
    const res = await fetch(`${base}/rest/v1/scores`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ game: GAME, name, score }),
    });
    if (!res.ok) throw new Error('submit ' + res.status);
  }

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function injectStyle() {
    if (document.getElementById('rk-style')) return;
    const s = document.createElement('style');
    s.id = 'rk-style';
    s.textContent = `
      .rk-back { position: fixed; inset: 0; background: rgba(13,10,20,.75); display: flex; align-items: center; justify-content: center; z-index: 10; padding: 16px; box-sizing: border-box; }
      .rk-box { width: 100%; max-width: 340px; max-height: 100%; overflow: auto; background: #f6efe0; color: #3a2e44; border: 4px solid #1b1626; box-shadow: 0 6px 0 #000; font-family: 'Galmuri11', sans-serif; }
      .rk-head { background: #26a69a; color: #fff; font-weight: 700; font-size: 20px; text-align: center; padding: 10px; }
      .rk-body { padding: 12px 14px 14px; }
      .rk-list { list-style: none; margin: 0 0 12px; padding: 0; font-size: 15px; }
      .rk-list li { display: flex; gap: 8px; padding: 5px 4px; border-bottom: 2px dashed #e2d6bd; }
      .rk-list li.me { background: #ffe9a8; }
      .rk-list .no { width: 26px; color: #6b5f7a; }
      .rk-list .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rk-list .sc { font-weight: 700; }
      .rk-msg { font-size: 14px; color: #6b5f7a; text-align: center; margin: 8px 0 12px; }
      .rk-form { display: flex; gap: 6px; margin-bottom: 8px; }
      .rk-form input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 8px; border: 3px solid #1b1626; background: #fff; color: #3a2e44; }
      .rk-btn { font: inherit; font-weight: 700; font-size: 15px; padding: 8px 12px; border: 3px solid #1b1626; background: #ffd84d; color: #3a2e44; box-shadow: 0 3px 0 #1b1626; cursor: pointer; }
      .rk-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #1b1626; }
      .rk-btn:disabled { opacity: .5; }
      .rk-btn.gray { background: #4b405a; color: #fff; width: 100%; }
      .rk-err { color: #e2453c; font-size: 13px; min-height: 16px; margin-bottom: 6px; }
      .rk-note { font-size: 12px; color: #8a7f98; text-align: center; margin-top: 10px; }
      .rk-note a { color: #8a7f98; }
    `;
    document.head.appendChild(s);
  }

  // round: 게임 판 번호(같은 판 점수는 한 번만 올림). score: 이번 판 점수(0이면 올리기 칸 없음)
  function open({ round = -1, score = 0 } = {}) {
    if (!enabled) return;
    injectStyle();
    close();
    modal = el('div', 'rk-back');
    const box = el('div', 'rk-box');
    box.appendChild(el('div', 'rk-head', '전체 순위 TOP 10'));
    const body = el('div', 'rk-body');
    const list = el('ol', 'rk-list');
    const msg = el('div', 'rk-msg', '불러오는 중…');
    body.append(msg, list);

    let myName = null, myScore = null;
    async function refresh() {
      try {
        const rows = await fetchTop();
        list.textContent = '';
        msg.textContent = rows.length ? '' : '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!';
        msg.style.display = rows.length ? 'none' : '';
        let marked = false;
        rows.forEach((r, i) => {
          const li = el('li');
          if (!marked && r.name === myName && r.score === myScore) { li.className = 'me'; marked = true; }
          li.append(el('span', 'no', (i + 1) + '.'), el('span', 'nm', r.name), el('span', 'sc', Number(r.score).toLocaleString('ko-KR')));
          list.appendChild(li);
        });
      } catch (e) {
        msg.style.display = '';
        msg.textContent = '순위표를 잠시 불러올 수 없어요.';
      }
    }

    if (score > 0 && round !== submittedRound) {
      const form = el('form', 'rk-form');
      const input = el('input');
      input.maxLength = MAX_NAME;
      input.placeholder = '닉네임 (8자까지)';
      input.value = loadName();
      input.autocomplete = 'off';
      const btn = el('button', 'rk-btn', '기록 올리기');
      btn.type = 'submit';
      const err = el('div', 'rk-err');
      const label = el('div', 'rk-msg', `이번 매출 ${score.toLocaleString('ko-KR')}점을 올릴까요?`);
      form.append(input, btn);
      body.append(label, form, err);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cleanName(input.value);
        if (!name) { err.textContent = '닉네임을 적어 주세요.'; return; }
        if (isBad(name)) { err.textContent = '다른 닉네임을 써 주세요.'; return; }
        btn.disabled = true;
        err.textContent = '';
        try {
          await submit(name, score);
          saveName(name);
          submittedRound = round;
          myName = name; myScore = score;
          label.remove(); form.remove(); err.remove();
          await refresh();
        } catch (ex) {
          btn.disabled = false;
          err.textContent = '기록을 올리지 못했어요. 잠시 뒤 다시 해 주세요.';
        }
      });
    }

    const closeBtn = el('button', 'rk-btn gray', '닫기');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    body.appendChild(closeBtn);
    const note = el('div', 'rk-note');
    const a = el('a', '', '개인정보처리방침');
    a.href = 'privacy.html';
    note.append('닉네임과 점수는 순위표에 공개돼요 · ', a);
    body.appendChild(note);
    box.appendChild(body);
    modal.appendChild(box);
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
    document.body.appendChild(modal);
    refresh();
  }

  function close() {
    if (modal) { modal.remove(); modal = null; }
  }

  return {
    enabled,
    open,
    close,
    get isOpen() { return Boolean(modal); },
    alreadySubmitted: round => round === submittedRound,
  };
})();
window.Ranking = Ranking;
