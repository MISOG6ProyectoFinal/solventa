import { useRef } from 'react';

import { languageNames, languageOptions, toLanguage } from '../i18n/language';
import { useLanguageStore } from '../i18n/useLanguageStore';
import { useTexts } from '../texts';
import { AppText } from './AppText';
import { Button } from './Button';
import { OptionList } from './OptionList';
import { Sheet, type SheetHandle } from './Sheet';

export function LanguageSelector() {
  const texts = useTexts();
  const sheet = useRef<SheetHandle>(null);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const change = (id: string) => {
    const next = toLanguage(id);
    if (next) {
      setLanguage(next);
      sheet.current?.dismiss();
    }
  };

  return (
    <>
      <Button
        title={languageNames[language]}
        variant="text"
        icon="idioma"
        onPress={() => sheet.current?.present()}
        testID="language-button"
      />
      <Sheet ref={sheet} onClose={() => undefined} testID="language-sheet">
        <AppText variant="subtitle">{texts.language}</AppText>
        <OptionList options={languageOptions} value={language} onChange={change} />
      </Sheet>
    </>
  );
}
