import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./universe/universe.component').then((module) => module.UniverseComponent),
  },
  {
    path: 'resume',
    loadComponent: () => import('./resume/dashboard/resume-dashboard.component').then((module) => module.ResumeDashboardComponent),
  },
  {
    path: 'resume/:id/edit',
    loadComponent: () => import('./resume/editor/resume-editor.component').then((module) => module.ResumeEditorComponent),
  },
  {
    path: 'r/:slug',
    loadComponent: () => import('./resume/publication/public-resume.component').then((module) => module.PublicResumeComponent),
  },
  {
    path: 'split',
    loadChildren: () => import('./split/split.routes').then((module) => module.splitRoutes),
  },
  { path: '**', redirectTo: '' },
];
