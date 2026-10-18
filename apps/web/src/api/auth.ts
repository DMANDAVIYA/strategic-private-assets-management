import type { AuthStatus, LoginInput, SetupInput, User } from "@financeper/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const authKeys = {
  all: ["auth"] as const,
  status: ["auth", "status"] as const,
};

export function fetchAuthStatus(): Promise<AuthStatus> {
  return api.get<AuthStatus>("/api/auth/status");
}

export const authStatusQuery = queryOptions({
  queryKey: authKeys.status,
  queryFn: fetchAuthStatus,
  staleTime: 5_000,
  retry: false,
});

export function useAuthStatus() {
  return useQuery(authStatusQuery);
}

export function useSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetupInput) => api.post<{ user: User }>("/api/auth/setup", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: User }>("/api/auth/login", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<null>("/api/auth/logout"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
}
