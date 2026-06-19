export interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
}

export interface UserRequest {
  name: string;
  email: string;
  password: string;
  active: boolean;
  roles: string[];
}
