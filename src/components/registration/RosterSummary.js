"use client";

import { getCategoryLabel, getEventName, getSportName } from "@/lib/registration/labels";

/**
 * Read-only summary of a saved roster, grouped by sport and event.
 * `entries` are rows from GET /api/registration.
 */
export default function RosterSummary({ entries = [] }) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.sportId}|${entry.gender}|${entry.eventId}`;
    if (!groups.has(key)) groups.set(key, { ...entry, members: [] });
    groups.get(key).members.push(entry);
  }
  const sorted = [...groups.values()].sort((a, b) =>
    getSportName(a.sportId).localeCompare(getSportName(b.sportId)) ||
    a.gender.localeCompare(b.gender) ||
    getEventName(a.sportId, a.eventId, a.gender).localeCompare(getEventName(b.sportId, b.eventId, b.gender))
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-ink-soft">No event entries were found for this registration.</p>;
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-control border border-line bg-white">
      {sorted.map((group) => (
        <section key={`${group.sportId}|${group.gender}|${group.eventId}`} className="px-4 py-3 sm:flex sm:gap-6">
          <h3 className="text-sm font-bold text-ink sm:w-56 sm:shrink-0">
            {getSportName(group.sportId)} · {getEventName(group.sportId, group.eventId, group.gender)}
            <span className="block text-xs font-medium text-ink-muted">{getCategoryLabel(group.gender)}</span>
          </h3>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft sm:mt-0">
            {group.members.map((member) => (
              <li key={member.id ?? `${member.rollNumber}-${member.isReserve}`}>
                {member.studentName}{" "}
                <span className="font-mono text-xs text-ink-muted">({member.rollNumber})</span>
                {member.isReserve && <span className="chip chip-gold ml-1.5 px-1.5 py-0.5 text-[11px]">Reserve</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
