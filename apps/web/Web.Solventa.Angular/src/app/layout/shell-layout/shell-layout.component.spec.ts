import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { STORAGE_KEYS } from '../../core/constants/storage-keys.constants';
import { OperatorRole } from '../../core/models/operator.model';
import { LocaleService } from '../../core/services/locale.service';
import { signInAs, signOut } from '../../core/testing/auth.testing';
import { ShellLayoutComponent } from './shell-layout.component';

@Component({ template: '' })
class EmptyPageComponent {}

describe('ShellLayoutComponent', () => {
  let fixture: ComponentFixture<ShellLayoutComponent>;
  let el: HTMLElement;

  const render = async (roles: OperatorRole[], name = 'Ana Gómez'): Promise<void> => {
    signInAs(roles, name);
    await TestBed.configureTestingModule({
      imports: [ShellLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: EmptyPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShellLayoutComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
  };
  const navItems = (): string[] =>
    Array.from(el.querySelectorAll<HTMLElement>('nav a')).map((item) => item.getAttribute('data-testid') ?? '');
  const byTestId = (testId: string): HTMLElement => el.querySelector<HTMLElement>(`[data-testid=${testId}]`)!;

  afterEach(() => {
    signOut();
    TestBed.inject(LocaleService).setLocale('es');
  });

  it('shows the name, the initials and the role of the operator', async () => {
    await render(['asesor'], 'Luis Pérez');

    expect(byTestId('web-profile-menu').textContent?.trim()).toBe('LP');
    expect(byTestId('web-operator-name').textContent).toContain('Luis Pérez');
    expect(byTestId('web-operator-role').textContent).toContain('Asesor');
    expect(el.textContent).not.toContain('Solventa Central');
  });

  it('translates the role of the operator', async () => {
    await render(['consulta']);
    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(byTestId('web-operator-role').textContent).toContain('Read only');
  });

  it('shows every menu item to an administrator', async () => {
    await render(['administrador']);

    expect(navItems()).toEqual(['nav-operaciones', 'nav-socios', 'nav-usuarios']);
  });

  it('hides partners and users from an advisor', async () => {
    await render(['asesor']);

    expect(navItems()).toEqual(['nav-operaciones']);
  });

  it('hides only users from a read-only operator', async () => {
    await render(['consulta']);

    expect(navItems()).toEqual(['nav-operaciones', 'nav-socios']);
  });

  it('signs out from the profile menu and goes to the login', async () => {
    await render(['administrador']);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    byTestId('web-profile-menu').click();
    await fixture.whenStable();
    byTestId('web-profile-logout').click();
    await fixture.whenStable();

    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.operator)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(el.querySelector('[data-testid=web-profile-dropdown]')).toBeNull();
  });
});
