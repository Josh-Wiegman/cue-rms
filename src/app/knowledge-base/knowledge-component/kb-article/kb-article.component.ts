import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { KbService } from '../kb.service';
import { switchMap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Article } from '../models/article.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-kb-article',
  templateUrl: './kb-article.component.html',
  styleUrls: ['./kb-article.component.scss'],
  imports: [CommonModule, DatePipe, RouterOutlet],
})
export class KbArticleComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private kb: KbService,
  ) {}

  article$!: Observable<Article | undefined>;

  ngOnInit(): void {
    this.article$ = this.route.paramMap.pipe(
      switchMap((params) => this.kb.get(params.get('id') || '')),
    );
  }
}
