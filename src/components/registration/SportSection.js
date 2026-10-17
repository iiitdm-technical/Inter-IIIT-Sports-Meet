"use client";

import EventBlock from "./EventBlock";

export default function SportSection({ sportConfig, gender, slotsMap, onChangeSlot, studentRegistry, isOpen, onToggle, errorSlotKeys }) {
  // Each sport appears only in the tab of a category it offers. Chess, the only
  // combined sport, is listed under 'mixed' and so appears only in Combined.
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

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden mb-4 ${errorCount > 0 ? 'border-red-200' : 'border-gray-100'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-700"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${filledCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`} aria-hidden="true">
            {sportConfig.name.substring(0, 1)}
          </div>
          <h3 className="font-bold text-gray-900 text-base sm:text-lg text-left">{sportConfig.name}</h3>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {errorCount > 0 && (
            <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
              {errorCount} to fix
            </span>
          )}
          {filledCount > 0 && (
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              {filledCount} {filledCount === 1 ? 'entry' : 'entries'}
            </span>
          )}
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div id={panelId} className="px-4 sm:px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/30">
          {content}
        </div>
      )}
    </div>
  );
}
