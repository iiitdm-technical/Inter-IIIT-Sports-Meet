"use client";

const STEPS = ["Roster locked", "Payment submitted", "Bank verified"];

/**
 * Progress through the three post-roster steps. `current` is the index of the
 * step in progress; steps before it are complete.
 */
export default function RegistrationSteps({ current }) {
  return (
    <ol className="grid grid-cols-3 gap-2 text-center" aria-label="Registration progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex flex-col items-center gap-1.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${done ? "bg-[#1b5e20] text-white" : active ? "border-2 border-amber-500 bg-amber-50 text-amber-800" : "border-2 border-gray-200 text-gray-500"}`}>
              {done ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : index + 1}
            </span>
            <span className={`text-xs font-bold ${done ? "text-[#1b5e20]" : active ? "text-amber-900" : "text-gray-500"}`}>
              {label}
              <span className="sr-only">{done ? " (complete)" : active ? " (in progress)" : " (not started)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
