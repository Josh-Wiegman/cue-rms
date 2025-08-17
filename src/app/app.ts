import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

const hello = 'd';
const x = 'yooo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('app');
}
