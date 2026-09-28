import type { MeshCentralHttpRequest } from '../../../types/meshcentral.types.js';
import type {
  PendingAuthentication,
  SupportedTwoFactorMethod,
} from '../jsonauth.types.js';

export type TransactionLookupResult =
  | { status: 'valid'; transaction: PendingAuthentication }
  | { status: 'invalid' | 'expired' | 'blocked' };

const transactionLifetimeMilliseconds = 5 * 60 * 1000;
const maximumAttempts = 5;

export class AuthTransactionService {
  private readonly transactions = new Map<string, PendingAuthentication>();

  constructor(
    private readonly now: () => number,
    private readonly randomToken: () => string,
  ) {}

  create(
    request: MeshCentralHttpRequest,
    userId: string,
    domainId: string,
    allowedMethods: string[],
  ): PendingAuthentication {
    this.removeExpired();
    const issuedAt = this.now();
    const transaction: PendingAuthentication = {
      id: this.createUniqueId(),
      userId,
      domainId,
      clientIp: request.clientIp,
      userAgent: this.getUserAgent(request),
      allowedMethods: [...allowedMethods],
      issuedAt,
      expiresAt: issuedAt + transactionLifetimeMilliseconds,
      attempts: 0,
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  lookup(
    request: MeshCentralHttpRequest,
    transactionId: string,
    domainId: string,
    method: string,
  ): TransactionLookupResult {
    const transaction = this.transactions.get(transactionId);
    if (transaction == null) return { status: 'invalid' };
    if (transaction.expiresAt <= this.now()) {
      this.transactions.delete(transactionId);
      return { status: 'expired' };
    }
    if (
      transaction.domainId !== domainId ||
      transaction.clientIp !== request.clientIp ||
      transaction.userAgent !== this.getUserAgent(request) ||
      !transaction.allowedMethods.includes(method)
    ) {
      return { status: 'invalid' };
    }
    if (transaction.attempts >= maximumAttempts) {
      this.transactions.delete(transactionId);
      return { status: 'blocked' };
    }
    return { status: 'valid', transaction };
  }

  recordFailure(transaction: PendingAuthentication): boolean {
    transaction.attempts += 1;
    if (transaction.attempts >= maximumAttempts) {
      this.transactions.delete(transaction.id);
      return true;
    }
    return false;
  }

  consume(transaction: PendingAuthentication): void {
    this.transactions.delete(transaction.id);
  }

  isSupportedMethod(method: string): method is SupportedTwoFactorMethod {
    return method === 'totp' || method === 'backup';
  }

  private createUniqueId(): string {
    let id = this.randomToken();
    while (this.transactions.has(id)) id = this.randomToken();
    return id;
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [id, transaction] of this.transactions) {
      if (transaction.expiresAt <= now) this.transactions.delete(id);
    }
  }

  private getUserAgent(request: MeshCentralHttpRequest): string | undefined {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value.join(' ') : value;
  }
}