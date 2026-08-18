import { unlockHaptics } from '@/core/haptics/haptics';

let unlocked = false;

/** iOS 需在使用者手勢中解鎖音訊（規格 §2.4） */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  unlockHaptics();
  try {
    const a = new Audio();
    a.muted = true;
    a.setAttribute('playsinline', '');
    a.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD/////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQCgAAAAAAAAAEgFj0RTgAAAAAAAAAAAAAAAAAAAP/7UGQAAAKUAFkFAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABAAABpAAAAA=';
    void a.play().catch(() => undefined);
  } catch { /* 忽略 */ }
  if (typeof speechSynthesis !== 'undefined') {
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch { /* 忽略 */ }
  }
}

export function isAudioUnlocked(): boolean { return unlocked; }
