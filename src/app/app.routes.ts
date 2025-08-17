import { Routes } from '@angular/router';
import { HomeComponent } from './home/home-component/home-component';
import { NotFoundComponent } from './shared/not-found-component/not-found-component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: '**', component: NotFoundComponent },
];
