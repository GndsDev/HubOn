import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeResponse {
  message: string;
}

export interface AuthSession {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: User;
}
