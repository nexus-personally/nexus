import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SplitCsrfStore } from './split-csrf.store';

export const splitAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = inject(SplitCsrfStore).value();
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (csrf && unsafe && request.url.startsWith('/api/split/')) {
    return next(request.clone({ setHeaders: { 'X-CSRF-Token': csrf } }));
  }
  return next(request);
};
