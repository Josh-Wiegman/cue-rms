import { Component } from '@angular/core';
import { MainNavigationComponent } from '../main-navigation-component/main-navigation-component';

@Component({
  selector: 'ui-shell',
  standalone: true,
  imports: [MainNavigationComponent],
  templateUrl: './ui-shell-component.html',
  styleUrl: './ui-shell-component.scss',
})
export class UiShellComponent {}
