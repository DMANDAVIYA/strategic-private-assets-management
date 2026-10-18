import { Link } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Panel } from "../components/Panel";

export function OverviewPage() {
  return (
    <AppShell title="Overview">
      <Panel title="Nothing to show yet" className="max-w-[560px]">
        <p className="mt-2 text-[0.86rem] text-muted">
          Add your first account in the next phase. For now, open Settings → Access to connect your phone.
        </p>
        <Link
          to="/settings/access"
          className="mt-3 inline-block text-[0.84rem] text-text underline underline-offset-2"
        >
          Open Access settings
        </Link>
      </Panel>
    </AppShell>
  );
}
