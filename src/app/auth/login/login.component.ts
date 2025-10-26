import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected isSubmitting = false;
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    await this.authService.ensureSessionResolved();
    if (this.authService.isAuthenticated()) {
      await this.redirectAfterLogin();
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.login(email, password);
      await this.redirectAfterLogin();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Unable to sign in.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private async redirectAfterLogin(): Promise<void> {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') ?? '/';
    await this.router.navigateByUrl(redirectTo || '/');
  }
}
