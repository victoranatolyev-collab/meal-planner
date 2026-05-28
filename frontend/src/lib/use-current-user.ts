import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '@/api/users';

/**
 * Текущий пользователь. Auth отложена (Auth.js — позже): берём первого из GET /api/users
 * (single-user dev). Без хардкода userId. Когда появится auth — заменяем тело этого хука.
 */
export function useCurrentUser() {
  const query = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const userId = query.data?.items[0]?.id ?? null;
  return {
    userId,
    hasUser: userId !== null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
