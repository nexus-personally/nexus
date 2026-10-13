export function safeSplitReturnUrl(url: string) {
  return url.startsWith('/split/') && !url.startsWith('//') ? url : '/split/home';
}

export function splitRouteAccess(authenticated: boolean, url: string): true | string {
  return authenticated
    ? true
    : `/split/login?returnUrl=${encodeURIComponent(safeSplitReturnUrl(url))}`;
}
export const splitLandingDestination = (authenticated: boolean) =>
  authenticated ? '/split/home' : '/split/login';
