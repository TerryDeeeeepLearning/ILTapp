import { create } from 'zustand';
import { DEFAULT_SETTINGS, type UserSettings } from '@/types';
import { loadSettings, saveSettings } from '@/core/db/db';
import { configureHaptics } from '@/core/haptics/haptics';

interface SettingsStore extends UserSettings {
  hydrated: boolean;
  set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
  hydrate(): Promise<void>;
}

function applyToDom(s: UserSettings) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.cb = s.colorBlindSafe ? '1' : '0';
  root.style.setProperty('--font-scale', String(s.fontScale));
  root.lang = s.locale;
  configureHaptics({ hapticsEnabled: s.hapticsEnabled, soundFeedbackEnabled: s.soundFeedbackEnabled });
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  set(key, value) {
    set({ [key]: value } as Partial<SettingsStore>);
    const next = { ...pick(get()), [key]: value } as UserSettings;
    applyToDom(next);
    void saveSettings(next);
  },
  async hydrate() {
    const stored = await loadSettings();
    const next = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    set({ ...next, hydrated: true });
    applyToDom(next);
  }
}));

function pick(s: SettingsStore): UserSettings {
  const { hydrated: _h, set: _s, hydrate: _hy, ...rest } = s;
  void _h; void _s; void _hy;
  return rest;
}
