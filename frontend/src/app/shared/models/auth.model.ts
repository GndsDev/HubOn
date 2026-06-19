import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: User;
}
