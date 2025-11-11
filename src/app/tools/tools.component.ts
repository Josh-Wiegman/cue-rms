import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';

@Component({
  selector: 'tools-component',
  standalone: true,
  imports: [UiShellComponent, RouterOutlet],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {}
