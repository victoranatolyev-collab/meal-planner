import { apiGet } from './client';

export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface UsersResponse {
  items: UserDto[];
  total: number;
}

export const fetchUsers = () => apiGet<UsersResponse>('/users');
