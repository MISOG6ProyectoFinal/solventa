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

  it('fills the parameters of a text', () => {
    const svc = TestBed.inject(LocaleService);
    expect(svc.t('breakdown.ramo', { ramo: 'Viaje' })).toBe('Ramo: Viaje');
    svc.setLocale('en');
    expect(svc.t('partners.contract', { status: 'Active', version: 'v2' })).toBe('API contract: Active · v2');
  });

  it('translates domain values and keeps the value when there is no translation', () => {
    const svc = TestBed.inject(LocaleService);
    svc.setLocale('en');
    expect(svc.label('status.policy', 'activa')).toBe('Active');
    expect(svc.label('quote.option', 'CC')).toBe('CC');
    expect(svc.label('ramo', 'ramo-hogar', 'Hogar')).toBe('Hogar');
  });

  it('reads the saved language', () => {
    localStorage.setItem('slv.locale', 'en');
    expect(TestBed.inject(LocaleService).t('settings.title')).toBe('Settings');
  });
});
