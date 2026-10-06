import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { SplitPasswordHasher } from './split-password-hasher.js';

@Injectable()
export class Argon2SplitPasswordHasher implements SplitPasswordHasher {
  hash(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hash: string, password: string) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
