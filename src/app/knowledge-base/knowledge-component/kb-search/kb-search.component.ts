/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { KbService } from '../kb.service';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-kb-search',
  templateUrl: './kb-search.component.html',
  styleUrls: ['./kb-search.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class KbSearchComponent implements OnInit, OnDestroy {
  control = new FormControl('');
  resultsCount = 0;
  private sub: any;

  constructor(private kb: KbService) {}

  ngOnInit() {
    this.sub = this.control.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => {
        if (q !== null) {
          this.kb
            .search(q)
            .subscribe((list) => (this.resultsCount = list.length));
        }
      });
  }

  clear() {
    this.control.setValue('');
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
