export interface SplitCurrentUser {
  id: string;
  email: string;
  displayName: string;
  accountStatus: 'active' | 'suspended' | 'disabled';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SplitAuthResponse {
  user: SplitCurrentUser;
  csrfToken: string;
}

export type SplitAuthState =
  | { status: 'restoring'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: SplitCurrentUser };
