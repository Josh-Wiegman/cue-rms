import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { KbService } from '../kb.service';
import { lastValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Article, ArticleAttachment } from '../models/article.model';

@Component({
  selector: 'app-submit-article',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './kb-submit-article.component.html',
  styleUrls: ['./kb-submit-article.component.scss'],
})
export class KbSubmitArticleComponent {
  private readonly fb = inject(FormBuilder);
  private readonly kb = inject(KbService);
  private readonly router = inject(Router);

  readonly folders$ = this.kb.listFolders();
  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    slug: ['', [Validators.required]],
    folderId: ['', Validators.required],
    excerpt: ['', [Validators.maxLength(300)]],
    body: ['', Validators.required],
    tags: [[] as string[]],
    heroImage: [''],
    estimatedReadMins: [10, [Validators.min(1)]],
    status: ['pending_review'],
    releaseRule: this.fb.group({
      sequenceIndex: [null],
      requiresArticles: [[] as string[]],
      requiresQuizzes: [[] as string[]],
    }),
    checklist: this.fb.array<FormGroup>([]),
  });

  attachments: ArticleAttachment[] = [];
  isSubmitting = false;
  message = '';
  private slugManuallyEdited = false;

  get checklist(): FormArray<FormGroup> {
    return this.form.get('checklist') as FormArray<FormGroup>;
  }

  addChecklistItem() {
    this.checklist.push(
      this.fb.group({
        id: [crypto.randomUUID()],
        label: ['', Validators.required],
      }),
    );
  }

  removeChecklistItem(index: number) {
    this.checklist.removeAt(index);
  }

  onTagInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    this.form.patchValue({ tags });
  }

  async onAttachmentSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    const articleId = this.form.getRawValue().slug || crypto.randomUUID();
    this.form.patchValue({ slug: articleId });
    for (const file of Array.from(files)) {
      try {
        const attachment = await lastValueFrom(this.kb.uploadAttachment(articleId, file));
        if (attachment) {
          this.attachments.push(attachment);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting) return;

    const id = this.form.value.slug || crypto.randomUUID();
    const article: Partial<Article> = {
      id,
      slug: this.form.value.slug || id,
      title: this.form.value.title ?? '',
      folderId: this.form.value.folderId ?? '',
      excerpt: this.form.value.excerpt ?? undefined,
      body: this.form.value.body ?? '',
      tags: this.form.value.tags ?? [],
      heroImage: this.form.value.heroImage ?? undefined,
      estimatedReadMins: this.form.value.estimatedReadMins ?? 10,
      status: (this.form.value.status as Article['status']) ?? 'pending_review',
      releaseRule: this.form.value.releaseRule ?? undefined,
      checklist: this.checklist.value as Article['checklist'],
      attachments: this.attachments,
    } as Article;

    this.isSubmitting = true;
    this.message = '';

    this.kb.upsertArticle(article).subscribe({
      next: () => {
        this.message = '✅ Article saved. It will appear once approved.';
        this.form.reset({ status: 'pending_review', estimatedReadMins: 10, tags: [] });
        this.attachments = [];
        this.isSubmitting = false;
        this.router.navigate(['/kb']);
      },
      error: (err) => {
        console.error(err);
        this.message = '❌ Failed to submit article. Please try again.';
        this.isSubmitting = false;
      },
    });
  }

  constructor() {
    const titleControl = this.form.get('title');
    const slugControl = this.form.get('slug');

    slugControl?.valueChanges.subscribe(() => {
      this.slugManuallyEdited = true;
    });

    titleControl
      ?.valueChanges.pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((title) => {
        if (!this.slugManuallyEdited) {
          slugControl?.setValue(this.slugify(title ?? ''), { emitEvent: false });
        }
      });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .substring(0, 80);
  }
}
