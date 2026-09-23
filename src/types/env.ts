export interface Bindings {
  DB: D1Database;
  AUTH_URL: string;
  SITE_NAME: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  SESSION_SECRET?: string;
  OIDC_SIGNING_KEY?: string;
}

export interface UserSessionInfo {
  id: string;
  user_id: string;
  expires_at: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  is_admin: number;
  email_verified: number;
}

export interface Variables {
  user?: AuthenticatedUser;
  session?: UserSessionInfo;
}

export interface AppContext {
  Bindings: Bindings;
  Variables: Variables;
}
