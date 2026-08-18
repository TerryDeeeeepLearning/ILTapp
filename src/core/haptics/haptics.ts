/**
 * 三層降級的觸覺回饋。
 * iOS Safari 不支援 navigator.vibrate（規格 §2.4），因此必須有可感知的替代方案，
 * 而不是靜默失敗。
 */

type Tier = 'vibrate' | 'ios-switch' | 'audio' | 'visual-only';

let tier: Tier | null = null;
let audioCtx: AudioContext | null = null;
let iosSwitch: HTMLInputElement | null = null;

export interface HapticConfig {
  hapticsEnabled: boolean;
  soundFeedbackEnabled: boolean;
}

let config: HapticConfig = { hapticsEnabled: true, soundFeedbackEnabled: true };
export function configureHaptics(c: HapticConfig) { config = c; }

function detectTier(): Tier {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    // Android / 部分桌面瀏覽器
    return 'vibrate';
  }
  if (typeof document !== 'undefined' && supportsSwitchAttr()) return 'ios-switch';
  if (typeof window !== 'undefined' && 'AudioContext' in window) return 'audio';
  return 'visual-only';
}

function supportsSwitchAttr(): boolean {
  try {
    const el = document.createElement('input');
    el.type = 'checkbox';
    return 'switch' in el;
  } catch { return false; }
}

/** iOS 17.4+ 的 switch 元件會觸發系統 haptic，這是 Web 目前唯一的路徑 */
function ensureIosSwitch(): HTMLInputElement {
  if (iosSwitch) return iosSwitch;
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  Object.assign(el.style, {
    position: 'fixed', left: '-9999px', top: '0',
    width: '1px', height: '1px', opacity: '0', pointerEvents: 'none'
  });
  document.body.appendChild(el);
  iosSwitch = el;
  return el;
}

/** 必須在使用者手勢中呼叫一次，解鎖 WebAudio */
export function unlockHaptics(): void {
  if (tier === null) tier = detectTier();
  if (!audioCtx && typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      audioCtx = new AudioContext();
      void audioCtx.resume();
    } catch { audioCtx = null; }
  }
}

function click(freq: number, ms: number, gain: number) {
  if (!config.soundFeedbackEnabled || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

export type HapticStrength = 'tick' | 'strong';

/** 語速滑桿刻度吸附時呼叫。strong 用於 1.0×（考試真實語速）。 */
export function hapticTick(strength: HapticStrength = 'tick'): void {
  if (!config.hapticsEnabled) return;
  if (tier === null) tier = detectTier();

  switch (tier) {
    case 'vibrate':
      navigator.vibrate(strength === 'strong' ? [12, 24, 12] : 8);
      return;
    case 'ios-switch':
      try {
        const el = ensureIosSwitch();
        el.checked = !el.checked;
        el.dispatchEvent(new Event('change', { bubbles: false }));
        if (strength === 'strong') {
          setTimeout(() => { el.checked = !el.checked; el.dispatchEvent(new Event('change')); }, 30);
        }
        return;
      } catch { /* 落到音效 */ }
      break;
    default:
      break;
  }
  click(strength === 'strong' ? 1400 : 2200, strength === 'strong' ? 14 : 8, strength === 'strong' ? 0.05 : 0.03);
}

export function hapticResult(correct: boolean): void {
  if (!config.hapticsEnabled) return;
  if (tier === null) tier = detectTier();
  if (tier === 'vibrate') { navigator.vibrate(correct ? 15 : [30, 40, 30]); return; }
  if (correct) click(880, 60, 0.04);
  else { click(220, 90, 0.05); setTimeout(() => click(180, 90, 0.05), 90); }
}

export function currentHapticTier(): Tier {
  if (tier === null) tier = detectTier();
  return tier;
}
