import { preferredAccessUrl, type AccessInfo } from "@financeper/shared";
import { useEffect, useState } from "react";
import { useAccessInfo } from "../api/system";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";

const SERVE_COMMAND = "tailscale serve --bg 7777";
const COPIED_FOR_MS = 2_000;

const INSTALL_STEPS = [
  "Install Tailscale on this PC from tailscale.com/download/windows.",
  "Install Tailscale on your iPhone from the App Store.",
  "Sign in to the same account on both, then come back here.",
];

const HOME_SCREEN_STEPS = [
  "Open the address above in Safari.",
  "Tap Share, then Add to Home Screen.",
  "Tap Add. The app opens full screen from your home screen.",
];

const HELP_CLASS = "mt-2 text-[0.86rem] leading-relaxed text-muted";
const STEPS_CLASS = "mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[0.86rem] leading-relaxed text-text";

function qrSrc(url: string): string {
  return `/api/system/access/qr.svg?url=${encodeURIComponent(url)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copiedAt, setCopiedAt] = useState<number | null>(null);

  useEffect(() => {
    if (copiedAt === null) {
      return;
    }
    const timer = setTimeout(() => setCopiedAt(null), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copiedAt]);

  function copy() {
    navigator.clipboard.writeText(value).then(
      () => setCopiedAt(Date.now()),
      () => setCopiedAt(null),
    );
  }

  return (
    <Button onClick={copy} className="min-w-[84px]">
      {copiedAt === null ? "Copy" : "Copied"}
    </Button>
  );
}

function PhonePanel({ url }: { url: string | null }) {
  return (
    <Panel title="Open on your phone">
      {url === null ? (
        <p className={HELP_CLASS}>No network address found. Connect this PC to Wi-Fi or Ethernet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-start gap-x-10 gap-y-5">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="break-all text-[1.5rem] font-semibold leading-tight tabular-nums text-text">{url}</p>
            <div>
              <CopyButton value={url} />
            </div>
          </div>
          <img
            alt={`QR code for ${url}`}
            src={qrSrc(url)}
            width={168}
            height={168}
            className="size-[168px] shrink-0 rounded-lg"
          />
        </div>
      )}
    </Panel>
  );
}

function TailscaleGuide({ tailscale }: { tailscale: AccessInfo["tailscale"] }) {
  if (!tailscale.installed) {
    return (
      <>
        <p className={HELP_CLASS}>Tailscale gives your phone a private address that works anywhere.</p>
        <ol className={STEPS_CLASS}>
          {INSTALL_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </>
    );
  }
  if (!tailscale.running) {
    return <p className={HELP_CLASS}>Start Tailscale on this PC and sign in, then come back here.</p>;
  }
  if (!tailscale.serveActive || tailscale.httpsUrl === null) {
    return (
      <>
        <p className={HELP_CLASS}>Run this once in a terminal opened as administrator, then come back here:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-hairline bg-ground px-3 py-2.5 text-[0.86rem] text-text">
          <code>{SERVE_COMMAND}</code>
        </pre>
        <p className={HELP_CLASS}>This gives your phone an https address that works anywhere.</p>
      </>
    );
  }
  return (
    <>
      <p className="mt-2 text-[0.86rem] font-semibold text-positive">Phone access is ready.</p>
      <p className="mt-1 break-all text-[0.95rem] tabular-nums text-text">{tailscale.httpsUrl}</p>
    </>
  );
}

function AccessSections({ info }: { info: AccessInfo }) {
  return (
    <div className="grid max-w-[920px] gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <PhonePanel url={preferredAccessUrl(info)} />
      </div>
      <Panel title="Tailscale">
        <TailscaleGuide tailscale={info.tailscale} />
      </Panel>
      <Panel title="On home Wi-Fi">
        {info.lanUrls.length === 0 ? (
          <p className={HELP_CLASS}>No network address found. Connect this PC to Wi-Fi or Ethernet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-[0.95rem] tabular-nums text-text">
            {info.lanUrls.map((url) => (
              <li key={url} className="break-all">
                {url}
              </li>
            ))}
          </ul>
        )}
        <p className={HELP_CLASS}>Works only when the phone is on the same network as this PC.</p>
      </Panel>
      <Panel title="Add to Home Screen on iPhone" className="lg:col-span-2">
        <ol className={STEPS_CLASS}>
          {HOME_SCREEN_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function AccessStatus() {
  const access = useAccessInfo();

  if (access.isPending) {
    return <p className="text-[0.86rem] text-muted">Checking how your phone can reach this PC…</p>;
  }
  if (access.isError) {
    return (
      <Panel className="max-w-[560px]">
        <p role="alert" className="text-[0.86rem] text-negative">
          Couldn't read the network status.
        </p>
        <Button variant="ghost" className="mt-3" onClick={() => void access.refetch()}>
          Try again
        </Button>
      </Panel>
    );
  }
  return <AccessSections info={access.data} />;
}

export function AccessPage() {
  return (
    <AppShell title="Settings">
      <AccessStatus />
    </AppShell>
  );
}
