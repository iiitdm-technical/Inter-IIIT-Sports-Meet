"use client";

import { fieldControl, fieldLabel } from "../api";

export const DEFAULT_SETTINGS = { name: "", pointsWin: 3, pointsDraw: 1, pointsLoss: 0, allowDraws: true, qualifyPerPool: 2, thirdPlace: true };

function NumberField({ id, label, value, onChange, min = -99, max = 99, hint }) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>{label}</label>
      <input
        id={id} type="number" inputMode="numeric" min={min} max={max} className={fieldControl} value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number.parseInt(e.target.value, 10) || 0)))}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && <p id={`${id}-hint`} className="meta mt-1">{hint}</p>}
    </div>
  );
}

/** Name, pool points, draws, qualifiers and the 3rd-place match. Points differ by sport. */
export default function SettingsFields({ idPrefix, value, onChange }) {
  return (
    <>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-name`} className={fieldLabel}>Name (optional)</label>
        <input id={`${idPrefix}-name`} className={fieldControl} maxLength={128} value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Singles, Doubles. Needed only for a second tournament in the same sport and category" />
      </div>
      <fieldset className="grid grid-cols-3 gap-3 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Pool points</legend>
        <NumberField id={`${idPrefix}-win`} label="Win" value={value.pointsWin} onChange={(v) => onChange({ pointsWin: v })} />
        <NumberField id={`${idPrefix}-draw`} label="Draw" value={value.pointsDraw} onChange={(v) => onChange({ pointsDraw: v })} />
        <NumberField id={`${idPrefix}-loss`} label="Loss" value={value.pointsLoss} onChange={(v) => onChange({ pointsLoss: v })} />
      </fieldset>
      <NumberField
        id={`${idPrefix}-qualify`} label="Teams through from each pool" min={0} max={16}
        value={value.qualifyPerPool} onChange={(v) => onChange({ qualifyPerPool: v })}
        hint="Highlighted in the standings. You still place the knockout teams yourself."
      />
      <div className="flex flex-col justify-center gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={value.allowDraws} onChange={(e) => onChange({ allowDraws: e.target.checked })} />
          Draws allowed in pool matches
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={value.thirdPlace} onChange={(e) => onChange({ thirdPlace: e.target.checked })} />
          3rd-place match (semi-final losers)
        </label>
      </div>
    </>
  );
}
