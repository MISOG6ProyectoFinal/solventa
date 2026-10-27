import { create } from 'zustand';

import { getDeviceLanguage } from './deviceLanguage';
import { type Language } from './language';
import { readLanguage, writeLanguage } from './languageStorage';

type LanguageState = {
  language: Language;
  loaded: boolean;
  setLanguage: (language: Language) => void;
  load: () => Promise<void>;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'es',
  loaded: false,
  setLanguage: (language) => {
    set({ language });
    // A failed write only loses the choice for the next launch.
    writeLanguage(language).catch(() => undefined);
  },
  load: async () => {
    let saved: Language | null = null;
    try {
      saved = await readLanguage();
    } catch {
      // An unreadable file leaves the device language.
    }
    set({ language: saved ?? getDeviceLanguage(), loaded: true });
  },
}));
