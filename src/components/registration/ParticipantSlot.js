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

  const inputBorder = hasError ? "border-red-400 bg-red-50/40" : "border-gray-300";
  const containerTone = hasError
    ? "bg-red-50 border-red-300"
    : isReserve ? "bg-orange-50/50 border-orange-100" : "bg-gray-50/50 border-gray-200";

  return (
    <div className={`p-3 rounded-lg border flex flex-col md:flex-row gap-3 items-start md:items-center ${containerTone}`}>
      <div className="w-24 shrink-0 font-bold text-xs uppercase tracking-wider text-gray-500" aria-hidden="true">
        {label}
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <div>
          <input
            id={inputId}
            type="text"
            aria-label={`${accessibleSlot}: roll number`}
            aria-invalid={hasError || undefined}
            placeholder="Roll Number"
            value={rollNumber}
            onChange={(e) => handleChange("rollNumber", e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded border focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 uppercase placeholder:normal-case font-mono ${inputBorder}`}
            maxLength={64}
          />
        </div>
        <div>
          <input
            type="text"
            aria-label={`${accessibleSlot}: student name`}
            aria-invalid={hasError || undefined}
            placeholder={knownName ? `Auto: ${knownName}` : "Student Name"}
            value={name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded border focus:outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 uppercase placeholder:normal-case ${inputBorder}`}
            maxLength={128}
          />
          {knownName && !name && rollNumber && (
            <p className="text-[10px] text-green-700 mt-1 font-medium">Using existing name</p>
          )}
        </div>
      </div>

      {!fixedGender && (
        <div className="w-full md:w-28 shrink-0 mt-2 md:mt-0">
          <select
            aria-label={`${accessibleSlot}: gender`}
            value={gender}
            onChange={(e) => handleChange("gender", e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:border-green-700 bg-white"
          >
            <option value="M">Male (M)</option>
            <option value="F">Female (F)</option>
          </select>
        </div>
      )}

      {(rollNumber || name) && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={`Clear ${accessibleSlot}`}
          className="shrink-0 self-end md:self-auto rounded px-2 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
