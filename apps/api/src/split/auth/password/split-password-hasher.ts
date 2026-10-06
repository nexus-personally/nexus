export const SPLIT_PASSWORD_HASHER = Symbol('SPLIT_PASSWORD_HASHER');

export interface SplitPasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}
