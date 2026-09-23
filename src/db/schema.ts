export interface User {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  email_verified: number; // 0 or 1
  is_active: number;      // 0 or 1
  is_admin: number;       // 0 or 1
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  user_agent: string | null;
}

export interface OAuthClient {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string; // JSON array of string
  allowed_scopes: string; // JSON array of string
  is_public: number; // 0 or 1
  created_at: number;
  updated_at: number;
}

export interface OAuthAuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  nonce?: string | null;
  expires_at: number;
  used: number; // 0 or 1
  created_at: number;
}

export interface OAuthToken {
  id: string;
  client_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string;
  expires_at: number;
  revoked: number; // 0 or 1
  created_at: number;
}

export type VerificationTokenType = 'verify_email' | 'reset_password';

export interface VerificationToken {
  token: string;
  user_id: string;
  type: VerificationTokenType | string;
  expires_at: number;
  used: number; // 0 or 1
  created_at: number;
}
