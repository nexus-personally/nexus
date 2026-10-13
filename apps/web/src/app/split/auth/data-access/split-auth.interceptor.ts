import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SplitCsrfStore } from './split-csrf.store';
import { SplitOfflineCacheService } from '../../data-access/split-offline-cache.service';
import { SPLIT_CACHE_REFRESH } from '../../data-access/split-offline-cache.service';
import { HttpErrorResponse, HttpResponse, type HttpEvent } from '@angular/common/http';
import {
  catchError,
  concatMap,
  finalize,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';

const pendingGets = new Map<string, Observable<HttpEvent<unknown>>>();

export const splitAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const csrfStore = inject(SplitCsrfStore);
  const cache = inject(SplitOfflineCacheService);
  const csrf = csrfStore.value();
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (unsafe && request.url.startsWith('/api/split/') && cache.offline()) {
    return throwError(
      () => new HttpErrorResponse({ status: 0, statusText: 'Offline — read only' }),
    );
  }
  if (csrf && unsafe && request.url.startsWith('/api/split/')) {
    return next(request.clone({ setHeaders: { 'X-CSRF-Token': csrf } }));
  }
  if (
    request.method === 'GET' &&
    request.url.startsWith('/api/split/') &&
    !request.url.includes('/auth/') &&
    !request.url.includes('/invites/')
  ) {
    const ownerId = cache.cacheScope();
    const requestKey = `${ownerId ?? 'anonymous'}:${request.urlWithParams}`;
    return from(cache.get(request.urlWithParams)).pipe(
      switchMap((cached) => {
        if (cache.offline()) {
          cache.showingSavedData.set(Boolean(cached));
          return cached
            ? of(
                new HttpResponse({
                  body: cached.body,
                  status: cached.status,
                  statusText: cached.statusText,
                  url: request.urlWithParams,
                }),
              )
            : next(request);
        }
        if (
          !request.context.get(SPLIT_CACHE_REFRESH) &&
          cached &&
          Date.now() - cached.savedAt < 30_000
        ) {
          return of(
            new HttpResponse({
              body: cached.body,
              status: cached.status,
              statusText: cached.statusText,
              url: request.urlWithParams,
            }),
          );
        }
        const existingRequest = pendingGets.get(requestKey);
        if (existingRequest) return existingRequest;
        const networkRequest = next(request).pipe(
          concatMap((event) => {
            if (event instanceof HttpResponse) {
              cache.showingSavedData.set(false);
              return from(
                cache.put(
                  request.urlWithParams,
                  event.body,
                  event.status,
                  event.statusText,
                  ownerId,
                ),
              ).pipe(map(() => event));
            }
            return of(event);
          }),
          catchError((error: unknown) => {
            if (!cached || !(error instanceof HttpErrorResponse) || error.status !== 0) {
              return throwError(() => error);
            }
            cache.showingSavedData.set(true);
            return of(
              new HttpResponse({
                body: cached.body,
                status: cached.status,
                statusText: cached.statusText,
                url: request.urlWithParams,
              }),
            );
          }),
          finalize(() => pendingGets.delete(requestKey)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        pendingGets.set(requestKey, networkRequest);
        return networkRequest;
      }),
    );
  }
  return next(request);
};
