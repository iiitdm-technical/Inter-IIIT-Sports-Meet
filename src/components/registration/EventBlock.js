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
    <div className="mb-6 last:mb-0">
      <div className="mb-3">
        <h4 className="font-bold text-gray-800 text-sm">{eventName}</h4>
        <p className="text-xs text-gray-500">Max {maxParticipants} participants{maxReserves ? ` + ${maxReserves} reserves` : ''}</p>
      </div>
      <div className="space-y-2">
        {mainSlots}
        {reserveSlots.length > 0 && (
          <div className="pt-2 border-t border-dashed border-gray-200 mt-2 space-y-2">
            {reserveSlots}
          </div>
        )}
      </div>
    </div>
  );
}
