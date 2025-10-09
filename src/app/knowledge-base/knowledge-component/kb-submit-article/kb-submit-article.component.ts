import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { KbService } from '../kb.service';
import { Article } from '../models/article.model';

@Component({
  selector: 'app-submit-article',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './kb-submit-article.component.html',
  styleUrls: ['./kb-submit-article.component.scss'],
})
export class KbSubmitArticleComponent {
  form: FormGroup;
  isSubmitting = false;
  message = '';

  constructor(
    private fb: FormBuilder,
    private kb: KbService,
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(150)]],
      excerpt: ['', [Validators.maxLength(300)]],
      body: ['', Validators.required], // Matches Article.body
      tags: [''],
    });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.message = '';

    const article: Article = {
      id: this.generateUUID(), // or use a UUID generator
      title: this.form.value.title,
      excerpt: this.form.value.excerpt || undefined,
      body: this.form.value.body,
      tags: this.form.value.tags
        ? this.form.value.tags.split(',').map((t: string) => t.trim())
        : [],
      updated_at: new Date().toISOString(),
    };

    this.kb.add(article).subscribe({
      next: () => {
        this.message = '✅ Article submitted successfully!';
        this.form.reset();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error(err);
        this.message = '❌ Failed to submit article. Please try again.';
        this.isSubmitting = false;
      },
    });
  }

  /** Create a URL-safe slug for the article ID */
  private generateUUID(): string {
    return crypto.randomUUID();
  }
}
