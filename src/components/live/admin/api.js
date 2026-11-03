/** Small fetch wrapper for the live admin screens: always resolves, never throws. */
export async function liveApi(url, { method = "GET", body } = {}) {
  try {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: json.error || "Something went wrong. Try again." };
    return { ok: true, status: response.status, data: json.data };
  } catch {
    return { ok: false, status: 0, error: "No connection. Check the network and try again." };
  }
}

export const fieldLabel = "mb-1.5 block text-sm font-semibold text-ink";
export const fieldControl = "w-full rounded-control border border-line bg-white px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:bg-ivory disabled:text-ink-muted sm:text-sm";
