"use client";

import ParticipantSlot from "./ParticipantSlot";
import { getSlotKey, getSlotInputId } from "@/lib/registration/client-utils";

const GENDER_LABELS = { M: "Men", F: "Women", mixed: "Combined" };

export default function EventBlock({ sportConfig, eventId, eventName, gender, slotsMap, onChangeSlot, maxParticipants, maxReserves, studentRegistry, errorSlotKeys }) {

  // Is it a combined event like Chess where gender is mixed?
  const isCombined = sportConfig.type === "combined_team" || gender === "mixed";
  // The actual fixed gender for slots. If combined, it's null so the selector appears.
  const fixedSlotGender = isCombined ? null : gender;
  const context = `${GENDER_LABELS[gender] || gender} ${eventName}`;

  const renderSlot = (role, i) => {
    const key = getSlotKey(sportConfig.id, eventId, gender, role, i);
    const data = slotsMap[key];
    const knownName = data?.rollNumber ? studentRegistry.get(data.rollNumber.trim().toUpperCase())?.name : null;
    return (
      <ParticipantSlot
        key={key}
        inputId={getSlotInputId(key)}
        label={role === "main" ? `Slot ${i + 1}` : `Reserve ${i + 1}`}
        context={context}
        slotData={data}
        onChange={(val) => onChangeSlot(key, val)}
        fixedGender={fixedSlotGender}
        isReserve={role === "reserve"}
        knownName={knownName}
        hasError={errorSlotKeys.has(key)}
      />
    );
  };

  const mainSlots = Array.from({ length: maxParticipants }, (_, i) => renderSlot("main", i));
  const reserveSlots = Array.from({ length: maxReserves || 0 }, (_, i) => renderSlot("reserve", i));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="heading-card">{eventName}</h4>
        <p className="meta">
          Up to {maxParticipants} {maxParticipants === 1 ? "participant" : "participants"}{maxReserves ? ` + ${maxReserves} ${maxReserves === 1 ? "reserve" : "reserves"}` : ""}
        </p>
      </div>
      <div className="space-y-2">
        {mainSlots}
        {reserveSlots.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-dashed border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gold-text">Reserves</p>
            {reserveSlots}
          </div>
        )}
      </div>
    </div>
  );
}
