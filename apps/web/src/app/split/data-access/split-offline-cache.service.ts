import { Injectable, signal } from '@angular/core';
import { HttpContextToken } from '@angular/common/http';
import type { SplitCurrentUser } from '../auth/data-access/split-auth.models';

interface CacheRecord {
  key: string;
  ownerId: string;
  savedAt: number;
  body: unknown;
  status: number;
  statusText: string;
}

const DB_NAME = 'nexus-split-local-v1';
const STORE_NAME = 'private-cache';
const LAST_USER_KEY = '__last_authenticated_user__';
export const SPLIT_CACHE_REFRESH = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class SplitOfflineCacheService {
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  readonly showingSavedData = signal(false);
  private ownerId: string | null = null;
  private database?: Promise<IDBDatabase | null>;

  cacheScope() {
    return this.ownerId;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => this.offline.set(true));
      window.addEventListener('online', () => this.offline.set(false));
    }
  }

  async activateUser(user: SplitCurrentUser) {
    const db = await this.open();
    if (!db) return;
    const previous = await this.readRecord<CacheRecord>(db, LAST_USER_KEY);
    const previousUser = (previous?.body as { user?: SplitCurrentUser } | undefined)?.user;
    if (previousUser?.id && previousUser.id !== user.id) await this.clearRecords(db);
    this.ownerId = user.id;
    await this.writeRecord(db, {
      key: LAST_USER_KEY,
      ownerId: user.id,
      savedAt: Date.now(),
      body: { user },
      status: 200,
      statusText: 'OK',
    });
  }

  async restoreLastUser() {
    const db = await this.open();
    if (!db) return undefined;
    const record = await this.readRecord<CacheRecord>(db, LAST_USER_KEY);
    const user = (record?.body as { user?: SplitCurrentUser } | undefined)?.user;
    if (user?.accountStatus !== 'active') return undefined;
    this.ownerId = user.id;
    return user;
  }

  async get(url: string): Promise<CacheRecord | undefined> {
    const db = await this.open();
    if (!db || !this.ownerId) return undefined;
    const record = await this.readRecord<CacheRecord>(db, `${this.ownerId}:${url}`);
    return record?.ownerId === this.ownerId ? record : undefined;
  }

  async put(
    url: string,
    body: unknown,
    status: number,
    statusText: string,
    expectedOwnerId = this.ownerId,
  ) {
    const db = await this.open();
    if (!db || !expectedOwnerId || expectedOwnerId !== this.ownerId) return;
    await this.writeRecord(db, {
      key: `${expectedOwnerId}:${url}`,
      ownerId: expectedOwnerId,
      savedAt: Date.now(),
      body,
      status,
      statusText,
    });
    await this.prune(db);
  }

  async invalidate(urlIncludes: string) {
    const db = await this.open();
    if (!db || !this.ownerId) return;
    const records = await this.allRecords(db);
    await Promise.all(
      records
        .filter((record) => record.ownerId === this.ownerId && record.key.includes(urlIncludes))
        .map((record) => this.deleteRecord(db, record.key)),
    );
  }

  async clear() {
    const db = await this.open();
    this.ownerId = null;
    this.showingSavedData.set(false);
    if (db) await this.clearRecords(db);
  }

  private open() {
    if (this.database) return this.database;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    this.database = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.database;
  }

  private readRecord<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => resolve(undefined);
    });
  }

  private writeRecord(db: IDBDatabase, value: CacheRecord): Promise<void> {
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  }

  private deleteRecord(db: IDBDatabase, key: string): Promise<void> {
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  }

  private allRecords(db: IDBDatabase): Promise<CacheRecord[]> {
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as CacheRecord[]);
      request.onerror = () => resolve([]);
    });
  }

  private async clearRecords(db: IDBDatabase) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  }

  private async prune(db: IDBDatabase) {
    const records = await this.allRecords(db);
    if (records.length <= 200) return;
    const candidates = records
      .filter((record) => record.key !== LAST_USER_KEY)
      .sort((a, b) => a.savedAt - b.savedAt)
      .slice(0, records.length - 200);
    await Promise.all(candidates.map((record) => this.deleteRecord(db, record.key)));
  }
}
