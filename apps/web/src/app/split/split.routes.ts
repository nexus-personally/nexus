import { Routes } from '@angular/router';
import { splitAuthGuard } from './auth/guards/split-auth.guard';
import { splitGuestGuard } from './auth/guards/split-guest.guard';
import { splitLandingGuard } from './auth/guards/split-landing.guard';

export const splitRoutes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [splitLandingGuard], children: [] },
  {
    path: 'login',
    canActivate: [splitGuestGuard],
    loadComponent: () =>
      import('./auth/pages/split-login/split-login.component').then(
        (module) => module.SplitLoginComponent,
      ),
  },
  {
    path: 'register',
    canActivate: [splitGuestGuard],
    loadComponent: () =>
      import('./auth/pages/split-register/split-register.component').then(
        (module) => module.SplitRegisterComponent,
      ),
  },
  {
    path: 'groups',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-groups.component').then((module) => module.SplitGroupsComponent),
  },
  {
    path: 'groups/new',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-group-form.component').then((m) => m.SplitGroupFormComponent),
  },
  {
    path: 'groups/:groupId/expenses/new',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-expense-editor.component').then((m) => m.SplitExpenseEditorComponent),
  },
  {
    path: 'groups/:groupId/settle',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-settle.component').then((m) => m.SplitSettleComponent),
  },
  {
    path: 'groups/:groupId/expenses/:expenseId/edit',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-expense-editor.component').then((m) => m.SplitExpenseEditorComponent),
  },
  {
    path: 'groups/:groupId/expenses/:expenseId',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-expense-detail.component').then((m) => m.SplitExpenseDetailComponent),
  },
  {
    path: 'groups/:groupId',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-group-detail.component').then((m) => m.SplitGroupDetailComponent),
  },
  {
    path: 'groups/:groupId/members',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-members.component').then((m) => m.SplitMembersComponent),
  },
  {
    path: 'groups/:groupId/settings',
    canActivate: [splitAuthGuard],
    loadComponent: () =>
      import('./pages/split-group-form.component').then((m) => m.SplitGroupFormComponent),
  },
  {
    path: 'invite/:token',
    loadComponent: () =>
      import('./pages/split-invite.component').then((m) => m.SplitInviteComponent),
  },
];
