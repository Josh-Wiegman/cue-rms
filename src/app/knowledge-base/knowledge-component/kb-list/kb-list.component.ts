import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // provides AsyncPipe, NgIf, NgFor
import { RouterModule } from '@angular/router';
import { KbService } from '../kb.service';
import { Observable } from 'rxjs';
import { Article } from '../models/article.model';
import { KbSearchComponent } from '../kb-search/kb-search.component';

@Component({
  selector: 'app-kb-list',
  standalone: true,
  imports: [CommonModule, RouterModule, KbSearchComponent],
  templateUrl: './kb-list.component.html',
  styleUrls: ['./kb-list.component.scss'],
})
export class KbListComponent implements OnInit {
  articles$!: Observable<Article[]>;
  constructor(private kb: KbService) {}
  ngOnInit() {
    this.articles$ = this.kb.list();
  }
}
