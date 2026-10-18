import { useId, type ReactNode } from "react";

type PanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, children, className = "" }: PanelProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title === undefined ? undefined : headingId}
      className={`rounded-panel bg-panel px-4 py-3.5 ${className}`}
    >
      {title === undefined ? null : (
        <h2 id={headingId} className="text-[0.84rem] font-semibold text-text">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
