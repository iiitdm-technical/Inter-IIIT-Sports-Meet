"use client";

export default function ParticipantSlot({ inputId, label, context, slotData, onChange, fixedGender, isReserve, knownName, hasError }) {
  const rollNumber = slotData?.rollNumber || "";
  const name = slotData?.name || "";
  const gender = slotData?.gender || fixedGender || "M";
  const accessibleSlot = `${context}, ${label}`;

  const handleChange = (field, value) => {
    onChange({
      rollNumber: field === "rollNumber" ? value.toUpperCase() : rollNumber,
      name: field === "name" ? value.toUpperCase() : name,
      gender: field === "gender" ? value : gender,
    });
  };

  const handleClear = () => onChange({ rollNumber: "", name: "", gender: fixedGender || "M" });

  const inputClass = `w-full rounded-control border bg-white px-3 py-2 text-sm text-ink placeholder:normal-case placeholder:text-ink-muted/70 uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${hasError ? "border-red-400 focus:border-red-600" : "border-line focus:border-brand-primary"}`;
  const containerTone = hasError
    ? "bg-red-50 border-red-300"
    : isReserve ? "bg-gold-wash/60 border-[#eadcb4]" : "bg-paper border-line";

  return (
    <div className={`grid grid-cols-1 items-center gap-2.5 rounded-control border p-2.5 sm:gap-3 md:grid-cols-[5.5rem_1fr_auto] ${containerTone}`}>
      <div className={`font-display text-sm font-bold uppercase tracking-wide ${hasError ? "text-red-800" : isReserve ? "text-gold-text" : "text-ink-muted"}`} aria-hidden="true">
        {label}
      </div>

      <div className={`grid w-full grid-cols-1 gap-2.5 ${fixedGender ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_1.4fr_8rem]"}`}>
        <input
          id={inputId}
          type="text"
          aria-label={`${accessibleSlot}: roll number`}
          aria-invalid={hasError || undefined}
          placeholder="Roll number"
          value={rollNumber}
          onChange={(e) => handleChange("rollNumber", e.target.value)}
          className={`${inputClass} font-mono`}
          maxLength={64}
        />
        <div>
          <input
            type="text"
            aria-label={`${accessibleSlot}: student name`}
            aria-invalid={hasError || undefined}
            placeholder={knownName ? `Auto: ${knownName}` : "Student name"}
            value={name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={inputClass}
            maxLength={128}
          />
          {knownName && !name && rollNumber && (
            <p className="mt-1 text-xs font-medium text-brand-primary">Using existing name</p>
          )}
        </div>
        {!fixedGender && (
          <select
            aria-label={`${accessibleSlot}: gender`}
            value={gender}
            onChange={(e) => handleChange("gender", e.target.value)}
            className="w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          >
            <option value="M">Male (M)</option>
            <option value="F">Female (F)</option>
          </select>
        )}
      </div>

      <div className="flex justify-end md:w-14">
        {(rollNumber || name) && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Clear ${accessibleSlot}`}
            className="rounded-md px-2 py-1.5 text-xs font-semibold text-ink-muted hover:bg-ivory-dark hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
