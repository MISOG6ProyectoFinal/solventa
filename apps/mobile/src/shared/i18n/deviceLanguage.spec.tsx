import { getDeviceLanguage } from './deviceLanguage';

function deviceLocale(locale: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);
}

describe('getDeviceLanguage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['en-US', 'en'],
    ['es-CO', 'es'],
    ['es', 'es'],
    ['fr-FR', 'es'],
  ])('maps the device locale %p to %p', (locale, expected) => {
    deviceLocale(locale);

    expect(getDeviceLanguage()).toBe(expected);
  });
});
