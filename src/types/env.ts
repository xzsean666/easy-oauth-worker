export interface Bindings {
  DB: D1Database;
  AUTH_URL: string;
  SITE_NAME: string;
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
  username: string;
  is_admin: number;
}

export interface Variables {
  user?: AuthenticatedUser;
  session?: UserSessionInfo;
}

export interface AppContext {
  Bindings: Bindings;
  Variables: Variables;
}
