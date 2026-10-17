"use client";

const STEPS = ["Roster locked", "Payment submitted", "Bank verified"];

/**
 * Progress through the three post-roster steps. `current` is the index of the
 * step in progress; steps before it are complete.
 */
export default function RegistrationSteps({ current }) {
  return (
    <ol className="grid grid-cols-3 text-center" aria-label="Registration progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-col items-center gap-2">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${index <= current ? "bg-brand-primary" : "bg-line"}`}
                aria-hidden="true"
              />
            )}
            <span className={`relative flex h-8 w-8 items-center justify-center rounded-full font-display text-base font-bold ${done ? "bg-brand-primary text-white" : active ? "border-2 border-brand-highlight bg-paper text-ink" : "border-2 border-line bg-paper text-ink-muted"}`}>
              {done ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : index + 1}
            </span>
            <span className={`px-1 text-xs font-semibold leading-tight ${done ? "text-brand-primary" : active ? "text-ink" : "text-ink-muted"}`}>
              {label}
              <span className="sr-only">{done ? " (complete)" : active ? " (in progress)" : " (not started)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
