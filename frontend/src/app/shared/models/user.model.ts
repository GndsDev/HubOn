export interface User {
  id: number;
  name: string;
  username: string;
  active: boolean;
  roles: string[];
}

export interface UserRequest {
  name: string;
  username: string;
  password: string;
  active: boolean;
  roles: string[];
}
