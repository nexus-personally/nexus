const isProduction = process.env.NODE_ENV === 'production';

export const SPLIT_SESSION_COOKIE = isProduction
  ? '__Host-nexus_split_session'
  : 'nexus_split_session';

export function readCookie(cookieHeader: string | undefined, name = SPLIT_SESSION_COOKIE) {
  if (!cookieHeader) return undefined;
  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return undefined;
}

export function splitCookieName(production: boolean) {
  return production ? '__Host-nexus_split_session' : 'nexus_split_session';
}

export function sessionCookie(token: string, expiresAt: Date, production = isProduction) {
  const secure = production ? '; Secure' : '';
  return `${splitCookieName(production)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie(production = isProduction) {
  const secure = production ? '; Secure' : '';
  return `${splitCookieName(production)}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}
