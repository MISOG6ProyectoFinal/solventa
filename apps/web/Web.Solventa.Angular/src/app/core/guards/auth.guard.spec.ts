import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signInAs, signOut } from '../testing/auth.testing';
import { OperatorRole } from '../models/operator.model';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

const state = (url: string): RouterStateSnapshot => ({ url }) as RouterStateSnapshot;
const route = (roles?: OperatorRole[]): ActivatedRouteSnapshot => ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;

describe('route guards', () => {
  let router: Router;

  const setup = (): void => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    router = TestBed.inject(Router);
  };
  const run = (guard: typeof authGuard, snapshot: ActivatedRouteSnapshot, url = '/ops') =>
    TestBed.runInInjectionContext(() => guard(snapshot, state(url)));
  const asUrl = (result: unknown): string => router.serializeUrl(result as UrlTree);

  afterEach(() => signOut());

  describe('authGuard', () => {
    it('lets an authenticated operator in', () => {
      signInAs(['consulta']);
      setup();

      expect(run(authGuard, route())).toBe(true);
    });

    it('sends the visitor to the login and remembers where they were going', () => {
      setup();

      expect(asUrl(run(authGuard, route(), '/partners?tab=1'))).toBe('/login?returnUrl=%2Fpartners%3Ftab%3D1');
    });
  });

  describe('roleGuard', () => {
    it('lets in a route without roles', () => {
      signInAs(['consulta']);
      setup();

      expect(run(roleGuard, route())).toBe(true);
    });

    it('lets in an operator who has one of the roles of the route', () => {
      signInAs(['consulta']);
      setup();

      expect(run(roleGuard, route(['administrador', 'consulta']))).toBe(true);
    });

    it('sends an operator without the role to operations', () => {
      signInAs(['asesor']);
      setup();

      expect(asUrl(run(roleGuard, route(['administrador', 'consulta'])))).toBe('/ops');
    });
  });
});
