import { AsyncPipe, CommonModule, DatePipe, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { KbService } from '../kb.service';
import { ArticleComment, ArticleWithRelations } from '../models/article.model';

@Component({
  selector: 'app-kb-article',
  standalone: true,
  templateUrl: './kb-article.component.html',
  styleUrls: ['./kb-article.component.scss'],
  imports: [CommonModule, AsyncPipe, DatePipe, ReactiveFormsModule, NgFor, NgIf, NgSwitch, NgSwitchCase],
})
export class KbArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly kb = inject(KbService);
  private readonly fb = inject(FormBuilder);

  readonly article$ = this.route.paramMap.pipe(
    switchMap((params) => this.kb.get(params.get('id') ?? '')),
  );

  readonly relatedArticles$ = this.article$.pipe(map((article) => article?.relatedArticles ?? []));
  readonly quiz$ = this.article$.pipe(map((article) => article?.quiz));

  readonly commentForm = this.fb.group({
    body: ['', [Validators.required, Validators.minLength(3)]],
    mentions: [[] as string[]],
  });

  quizForm: FormGroup = this.fb.group({});

  submittingComment = false;
  submittingQuiz = false;
  acknowledgementMessage = '';

  constructor() {
    this.quiz$.subscribe((quiz) => {
      if (!quiz) return;
      const controls: Record<string, FormControl> = {};
      quiz.questions.forEach((question) => {
        const validators = [Validators.required];
        let initial: unknown = [];
        switch (question.type) {
          case 'short_text':
            initial = '';
            break;
          case 'true_false':
            initial = null;
            break;
          case 'single':
            initial = null;
            break;
          default:
            initial = [];
            break;
        }
        controls[question.id] = new FormControl(initial, validators);
      });
      this.quizForm = this.fb.group(controls);
    });
  }

  submitComment(article: ArticleWithRelations) {
    if (this.commentForm.invalid || this.submittingComment) return;
    this.submittingComment = true;
    const { body, mentions } = this.commentForm.value;

    this.kb.addComment(article.id, body ?? '', mentions ?? []).subscribe({
      next: (comment) => {
        article.comments = [...(article.comments ?? []), comment];
        this.commentForm.reset({ body: '', mentions: [] });
        this.submittingComment = false;
      },
      error: () => {
        this.submittingComment = false;
      },
    });
  }

  acknowledge(articleId: string) {
    this.kb.acknowledgeArticle(articleId).subscribe((res) => {
      this.acknowledgementMessage = `Acknowledged on ${new Date(res.acknowledgedAt).toLocaleString()}`;
    });
  }

  toggleFavourite(articleId: string) {
    this.kb.toggleFavourite(articleId).subscribe();
  }

  completeChecklist(articleId: string, itemId: string, completed: boolean) {
    this.kb.recordArticleProgress(articleId, completed).subscribe();
  }

  submitQuiz(articleId: string, quizId: string) {
    if (this.quizForm.invalid || this.submittingQuiz) return;
    this.submittingQuiz = true;
    this.kb.submitQuizAttempt(quizId, this.quizForm.value).subscribe({
      next: () => {
        this.submittingQuiz = false;
        this.acknowledgementMessage = 'Quiz submitted! We will let your admin know you passed.';
      },
      error: () => {
        this.submittingQuiz = false;
      },
    });
  }

  trackByComment(_: number, comment: ArticleComment) {
    return comment.id;
  }

  toggleMulti(questionId: string, choiceId: string, checked: boolean) {
    const control = this.quizForm.get(questionId);
    if (!control) return;
    const value: string[] = Array.isArray(control.value) ? control.value : [];
    const next = checked
      ? Array.from(new Set([...value, choiceId]))
      : value.filter((id) => id !== choiceId);
    control.setValue(next);
    control.markAsDirty();
  }
}
