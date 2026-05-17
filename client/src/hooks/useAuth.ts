import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  return {
    user: user ?? null,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
    loginUrl: getLoginUrl(),
  };
}
