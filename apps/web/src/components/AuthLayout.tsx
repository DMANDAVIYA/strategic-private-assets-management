import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  lead?: string;
  children: ReactNode;
};

export function AuthLayout({ title, lead, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <p className="mb-6 text-[0.95rem] font-bold text-text">financeper</p>
        <h1 className="text-[1.45rem] font-semibold tracking-tight text-text">{title}</h1>
        {lead === undefined ? null : <p className="mt-1.5 text-[0.86rem] text-muted">{lead}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}
