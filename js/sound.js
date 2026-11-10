// 효과음: 파일 없이 웹오디오로 삑삑 소리를 만든다.
'use strict';

const Sound = (() => {
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('pixelmart.muted') === '1'; } catch (e) { /* 무시 */ }

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, start, dur, type = 'square', vol = 0.08, slideTo = null) {
    const a = ctx();
    if (!a || muted) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  return {
    unlock() { ctx(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('pixelmart.muted', muted ? '1' : '0'); } catch (e) { /* 무시 */ }
      return muted;
    },
    beep() { tone(1320, 0, 0.06, 'square', 0.05); },             // 바코드 찍기
    wrong() { tone(160, 0, 0.22, 'sawtooth', 0.07, 110); },       // 틀림
    done() { tone(988, 0, 0.08); tone(1319, 0.08, 0.16); },       // 계산 완료
    door() { tone(784, 0, 0.12, 'triangle', 0.05); tone(659, 0.13, 0.18, 'triangle', 0.05); }, // 띵동
    angry() { tone(220, 0, 0.12, 'square', 0.06); tone(180, 0.12, 0.2, 'square', 0.06); },
    bonus() { tone(784, 0, 0.08); tone(988, 0.08, 0.08); tone(1319, 0.16, 0.18); },
    over() { tone(392, 0, 0.18, 'triangle', 0.08); tone(330, 0.2, 0.18, 'triangle', 0.08); tone(262, 0.4, 0.35, 'triangle', 0.08); },
    clear() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.16, 'square', 0.06)); },
  };
})();
