export type SplitAccountStatus = 'active' | 'suspended' | 'disabled';

export interface SplitCurrentUser {
  id: string;
  email: string;
  displayName: string;
  accountStatus: SplitAccountStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedSplitPrincipal {
  splitUserId: string;
  splitSessionId: string;
}

export interface SplitAuthenticatedSession {
  user: SplitCurrentUser;
  sessionId: string;
}

export interface SplitAuthResult {
  user: SplitCurrentUser;
  sessionToken: string;
  csrfToken: string;
  absoluteExpiresAt: Date;
}
