import { createHash, randomBytes } from 'node:crypto';

export function createCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function createCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function createOAuthState(): string {
  return randomBytes(24).toString('base64url');
}
