import { Component } from '@angular/core';
import { MainNavigationComponent } from '../main-navigation-component/main-navigation-component';
import { HeaderComponent } from '../header-component/header-component';

@Component({
  selector: 'ui-shell',
  standalone: true,
  imports: [MainNavigationComponent, HeaderComponent],
  templateUrl: './ui-shell-component.html',
  styleUrl: './ui-shell-component.scss',
})
export class UiShellComponent {}
