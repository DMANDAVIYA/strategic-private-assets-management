import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export function Field({ id, label, error, className = "", ...input }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8rem] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={`min-h-11 w-full rounded-lg border border-hairline bg-ground px-2.5 py-2 text-base text-text placeholder:text-faint aria-invalid:border-negative sm:min-h-0 sm:text-[0.88rem] ${className}`}
        {...input}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-[0.78rem] text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
