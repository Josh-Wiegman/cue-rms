import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AsyncPipe, CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';
import { Observable, Subscription } from 'rxjs';
import { KbService } from '../kb.service';
import { Article } from '../models/article.model';

@Component({
  selector: 'app-kb-search',
  templateUrl: './kb-search.component.html',
  styleUrls: ['./kb-search.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, AsyncPipe],
})
export class KbSearchComponent implements OnInit, OnDestroy {
  private readonly kb = inject(KbService);
  control = new FormControl('', { nonNullable: true });
  results$!: Observable<Article[]>;
  private sub = new Subscription();

  ngOnInit() {
    this.sub.add(
      this.control.valueChanges
        .pipe(startWith(''), debounceTime(250), distinctUntilChanged())
        .subscribe((term) => this.kb.updateFilters({ term })),
    );
    this.results$ = this.control.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term) => this.kb.search(term ?? '')),
    );
  }

  clear() {
    this.control.setValue('');
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
