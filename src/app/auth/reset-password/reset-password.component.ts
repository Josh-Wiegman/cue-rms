import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SupabaseService } from '../../shared/supabase-service/supabase.service';

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value as string | null;
    const confirm = control.get('confirmPassword')?.value as string | null;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordsMismatch: true };
  };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected state: 'loading' | 'form' | 'success' | 'error' = 'loading';
  protected isSubmitting = false;
  protected errorMessage = '';

  protected readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordMatchValidator() },
  );

  async ngOnInit(): Promise<void> {
    await this.initialiseSessionFromLink();
  }

  protected get passwordsMismatch(): boolean {
    return !!this.form.errors?.['passwordsMismatch'];
  }

  protected get passwordControl(): FormControl<string> {
    return this.form.controls.password;
  }

  protected get confirmPasswordControl(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  private async initialiseSessionFromLink(): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    const type = query.get('type');
    const accessToken = query.get('access_token');
    const refreshToken = query.get('refresh_token');

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      this.state = 'error';
      this.errorMessage = 'This password reset link is invalid or has expired. Please request a new one.';
      return;
    }

    const { error } = await this.supabaseService.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Failed to apply password reset session', error);
      this.state = 'error';
      this.errorMessage = error.message ?? 'Unable to validate the reset link. Please request a new one.';
      return;
    }

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });

    this.state = 'form';
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const password = this.form.controls.password.value;
      const { error } = await this.supabaseService.client.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      await this.supabaseService.client.auth.signOut();
      this.state = 'success';
    } catch (error) {
      console.error('Failed to update password', error);
      const message =
        error instanceof Error
          ? error.message
          : 'We could not update your password. Please try again.';
      this.errorMessage = message;
    } finally {
      this.isSubmitting = false;
    }
  }
}
