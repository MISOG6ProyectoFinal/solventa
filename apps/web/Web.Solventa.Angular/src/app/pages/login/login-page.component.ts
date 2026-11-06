import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/interfaces/api-response.interface';
import { AuthService } from '../../core/services/auth.service';
import { LocaleService } from '../../core/services/locale.service';
import { InputDirective } from '../../shared/directives/input.directive';
import { isEmail } from '../../shared/utils/validators';
import { AlertComponent } from '../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../ui/components/button/button.component';
import { CardComponent } from '../../ui/components/card/card.component';
import { FieldComponent } from '../../ui/components/field/field.component';
import { LogoComponent } from '../../ui/components/logo/logo.component';

const DEFAULT_URL = '/ops';
const UNAUTHORIZED = 401;

/** Inicio de sesión del operador. Al entrar va a `returnUrl` (si es una ruta interna) o a Operaciones. */
@Component({
  selector: 'slv-login-page',
  imports: [FormsModule, CardComponent, FieldComponent, InputDirective, ButtonComponent, AlertComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  protected readonly locale = inject(LocaleService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string | undefined>();

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly submitError = signal<string | null>(null);
  protected readonly sending = signal(false);

  protected submit(): void {
    const errors = this.validate();
    this.errors.set(errors);
    this.submitError.set(null);
    if (Object.keys(errors).length || this.sending()) return;

    this.sending.set(true);
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: () => {
        this.sending.set(false);
        void this.router.navigateByUrl(this.targetUrl());
      },
      error: (error: ApiError) => {
        this.sending.set(false);
        this.submitError.set(error.status === UNAUTHORIZED ? error.message : this.locale.t('login.error'));
      },
    });
  }

  private targetUrl(): string {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : DEFAULT_URL;
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const required = this.locale.t('common.requiredShort');
    const email = this.email().trim();
    if (!email) errors['email'] = required;
    else if (!isEmail(email)) errors['email'] = this.locale.t('login.emailInvalid');
    if (!this.password()) errors['password'] = required;
    return errors;
  }
}
