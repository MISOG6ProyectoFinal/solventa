import { TestBed } from '@angular/core/testing';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to Spanish', () => {
    const svc = TestBed.inject(LocaleService);
    expect(svc.locale()).toBe('es');
    expect(svc.t('web.nav.ops')).toBe('Operaciones y Pólizas');
  });

  it('switches language through the signal and persists it', () => {
    const svc = TestBed.inject(LocaleService);
    svc.setLocale('en');
    expect(svc.locale()).toBe('en');
    expect(svc.t('web.nav.ops')).toBe('Operations & Policies');
    expect(localStorage.getItem('slv.locale')).toBe('en');
  });

  it('returns the key when a translation is missing', () => {
    expect(TestBed.inject(LocaleService).t('no.such.key')).toBe('no.such.key');
  });
});
