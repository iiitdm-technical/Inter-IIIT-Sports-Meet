"use client";

import EventBlock from "./EventBlock";

export default function SportSection({ sportConfig, gender, slotsMap, onChangeSlot, studentRegistry, isOpen, onToggle, errorSlotKeys }) {
  // Each sport appears only in the tab of a category it offers. Chess and the
  // athletics and aquatics mixed relays are listed under 'mixed' (Combined).
  if (!sportConfig.genders.includes(gender)) {
    return null;
  }

  const panelId = `sport-panel-${sportConfig.id}-${gender}`;
  let content = null;

  if (sportConfig.type === "team" || sportConfig.type === "combined_team") {
    const limit = sportConfig.teamLimits[gender] || 0;
    content = (
      <EventBlock
        sportConfig={sportConfig}
        eventId="team"
        eventName={`${sportConfig.name} Squad`}
        gender={gender}
        slotsMap={slotsMap}
        onChangeSlot={onChangeSlot}
        maxParticipants={limit}
        maxReserves={0}
        studentRegistry={studentRegistry}
        errorSlotKeys={errorSlotKeys}
      />
    );
  } else if (sportConfig.type === "event_based" || sportConfig.type === "weight_category_based") {
    const events = sportConfig.events[gender] || [];
    content = events.map(ev => (
      <EventBlock
        key={ev.id}
        sportConfig={sportConfig}
        eventId={ev.id}
        eventName={ev.name}
        gender={gender}
        slotsMap={slotsMap}
        onChangeSlot={onChangeSlot}
        maxParticipants={ev.maxParticipants}
        maxReserves={ev.maxReserves || 0}
        slotGenders={ev.slotGenders}
        reserveGenders={ev.reserveGenders}
        isRelay={ev.isRelay}
        studentRegistry={studentRegistry}
        errorSlotKeys={errorSlotKeys}
      />
    ));
  }

  // Count filled and problem slots for this sport & gender
  const prefix = `${sportConfig.id}|`;
  const genderPart = `|${gender}|`;
  let filledCount = 0;
  for (const [key, val] of Object.entries(slotsMap)) {
    if (key.startsWith(prefix) && key.includes(genderPart) && val?.rollNumber?.trim()) filledCount++;
  }
  let errorCount = 0;
  for (const key of errorSlotKeys) {
    if (key.startsWith(prefix) && key.includes(genderPart)) errorCount++;
  }

  const statusTone = errorCount > 0
    ? 'bg-red-100 text-red-700'
    : filledCount > 0 ? 'bg-green-wash text-brand-primary' : 'bg-ivory-dark text-ink-muted';

  return (
    <div className={`card overflow-hidden ${errorCount > 0 ? 'border-red-300' : ''} ${isOpen ? 'shadow-lift' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ivory/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${statusTone}`} aria-hidden="true">
            {errorCount > 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            ) : filledCount > 0 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-current" />
            )}
          </div>
          <h3 className="truncate font-display text-xl font-bold uppercase tracking-wide text-ink sm:text-[22px]">{sportConfig.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {errorCount > 0 && (
            <span className="chip bg-red-100 text-red-800 normal-case tracking-normal">
              {errorCount} to fix
            </span>
          )}
          {filledCount > 0 && (
            <span className="chip normal-case tracking-normal">
              {filledCount} {filledCount === 1 ? 'entry' : 'entries'}
            </span>
          )}
          <svg className={`h-5 w-5 text-ink-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div id={panelId} className="space-y-6 border-t border-line bg-ivory/60 px-4 pb-6 pt-5 sm:px-5">
          {content}
        </div>
      )}
    </div>
  );
}
