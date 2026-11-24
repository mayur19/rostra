import type { Role } from '@rostra/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import type { Db } from '../db/pool.js';
import type { AuthLimiters } from '../security/limiters.js';

export interface AuthContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly email: string;
  readonly name: string;
  readonly csrfToken: string;
}

export interface AppDeps {
  readonly config: AppConfig;
  readonly db: Db;
  readonly logger: Logger;
  readonly limiters: AuthLimiters;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyContextConfig {
    /** Pending (501) routes skip CSRF so the stub answers consistently. */
    pending?: boolean;
  }
}

export const SESSION_COOKIE = 'rostra_session';
export const CSRF_COOKIE = 'rostra_csrf';
export const CSRF_HEADER = 'x-csrf-token';
