import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authStatusQuery } from "../api/auth";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";

export function UnreachablePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const retry = useMutation({
    mutationFn: () => queryClient.fetchQuery(authStatusQuery),
    onSuccess: () => navigate({ to: "/" }),
  });

  return (
    <AuthLayout
      title="Can't reach your PC"
      lead="financeper runs on your Windows PC. Make sure it's on and you're connected via Tailscale or home Wi-Fi."
    >
      <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
        Try again
      </Button>
    </AuthLayout>
  );
}
