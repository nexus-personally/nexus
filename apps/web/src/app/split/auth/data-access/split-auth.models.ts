export interface SplitCurrentUser {
  id: string;
  username: string;
  displayName: string;
  monthlyBudgetMinor: number | null;
  accountStatus: 'active' | 'suspended' | 'disabled';
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
  | { status: 'authenticated' | 'offline-authenticated'; user: SplitCurrentUser };
