import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kb-sidebar',
  templateUrl: './kb-sidebar.component.html',
  styleUrls: ['./kb-sidebar.component.scss'],
  imports: [RouterModule, CommonModule],
})
export class KbSidebarComponent {
  categories = [
    {
      name: 'Getting Started',
      slug: 'getting-started',
      children: [
        { id: 'intro', title: 'Introduction' },
        { id: 'setup', title: 'Setup Guide' },
      ],
    },
    {
      name: 'Deployment',
      slug: 'deployment',
      children: [{ id: 'hosting', title: 'Hosting Options' }],
    },
  ];
}
