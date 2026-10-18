import type { AccessInfo } from "@financeper/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const systemKeys = {
  all: ["system"] as const,
  access: ["system", "access"] as const,
};

export function fetchAccessInfo(): Promise<AccessInfo> {
  return api.get<AccessInfo>("/api/system/access");
}

export const accessInfoQuery = queryOptions({
  queryKey: systemKeys.access,
  queryFn: fetchAccessInfo,
  staleTime: 5_000,
  refetchInterval: 10_000,
  retry: false,
});

export function useAccessInfo() {
  return useQuery(accessInfoQuery);
}
