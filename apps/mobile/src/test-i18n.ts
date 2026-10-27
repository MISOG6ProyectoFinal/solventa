import { useLanguageStore } from './shared/i18n/useLanguageStore';

// Specs assert Spanish copy unless they switch the language themselves.
beforeEach(() => {
  useLanguageStore.setState({ language: 'es', loaded: true });
});
