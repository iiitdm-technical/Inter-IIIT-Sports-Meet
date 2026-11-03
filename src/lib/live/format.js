/** Display helpers for the live board, safe to use in the browser. Times are shown in IST. */

const IST = "Asia/Kolkata";

export const GENDER_LABELS = { M: "Men", F: "Women", mixed: "Mixed", all: "All categories" };

export function genderLabel(gender) {
  return GENDER_LABELS[gender] || gender || "";
}

const timeFormat = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const dayFormat = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatTime(iso) {
  return iso ? timeFormat.format(new Date(iso)) : "";
}

export function formatDay(iso) {
  return iso ? dayFormat.format(new Date(iso)) : "";
}

/** "Today, 4:30 pm" or "Sat 19 Dec, 9:00 am". */
export function formatWhen(iso, now = new Date()) {
  if (!iso) return "";
  const same = dayKeyFormat.format(new Date(iso)) === dayKeyFormat.format(now);
  return `${same ? "Today" : formatDay(iso)}, ${formatTime(iso)}`;
}

/** ISO time → value for <input type="datetime-local">, in IST whatever the device's zone. */
export function toIstInput(iso) {
  if (!iso) return "";
  const shifted = new Date(new Date(iso).getTime() + 330 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value, read as IST → ISO time. */
export function fromIstInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) return "";
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function agoLabel(iso, now = Date.now()) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

export function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  return `${n}${suffix}`;
}

/** Sport · category · event, e.g. "Athletics · Men · 100m". */
export function matchTitle(match) {
  return [match.sportName, genderLabel(match.gender), match.eventName].filter(Boolean).join(" · ");
}
