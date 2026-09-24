import { Routes } from '@angular/router';
import { ResumeDashboardComponent } from './resume/dashboard/resume-dashboard.component';
import { ResumeEditorComponent } from './resume/editor/resume-editor.component';
import { PublicResumeComponent } from './resume/publication/public-resume.component';
import { UniverseComponent } from './universe/universe.component';
import { adminAccessGuard } from './core/admin-access.guard';

export const routes: Routes = [
  { path: '', component: UniverseComponent },
  { path: 'resume', component: ResumeDashboardComponent },
  { path: 'resume/:id/edit', component: ResumeEditorComponent, canActivate: [adminAccessGuard] },
  { path: 'r/:slug', component: PublicResumeComponent },
  { path: '**', redirectTo: '' },
];
