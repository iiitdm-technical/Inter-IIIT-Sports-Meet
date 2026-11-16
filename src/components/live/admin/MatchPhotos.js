"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { liveApi } from "./api";
import { preparePhoto } from "./photo-compress";

async function uploadOne(matchId, file) {
  const { photo, thumb } = await preparePhoto(file);
  const form = new FormData();
  form.append("photo", photo, "photo.jpg");
  if (thumb) form.append("thumb", thumb, "thumb.jpg");
  try {
    const response = await fetch(`/api/admin/live/matches/${matchId}/photos`, { method: "POST", body: form, cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: json.error || "The photo could not be saved. Try again." };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: "No connection. Check the network and try again." };
  }
}

/**
 * Photos of one match on the scoring screen. While the match is live the
 * volunteer adds `required` photos (camera or gallery); coordinators cannot
 * finish the match until all are in. Photos go to the Sports SAC's folder
 * of each IIIT in the match.
 */
export default function MatchPhotos({ match, isSuper, required, count, onCountChange }) {
  const live = match.status === "live";
  const canAdd = live || (isSuper && match.status === "completed");
  const canRemove = live || isSuper;
  const [open, setOpen] = useState(live);
  const [photos, setPhotos] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const idPrefix = `m${match.id}-photos`;

  const load = useCallback(async () => {
    const result = await liveApi(`/api/admin/live/matches/${match.id}/photos`);
    if (!result.ok) return setError(result.error);
    setPhotos(result.data.photos);
    onCountChange(result.data.photos.length);
  }, [match.id, onCountChange]);

  // load() only sets state after its request finishes.
  useEffect(() => { if (open) load(); }, [open, load]); // eslint-disable-line react-hooks/set-state-in-effect

  const shown = photos ? photos.length : count;
  const remaining = Math.max(0, required - shown);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, remaining);
    if (!files.length) return;
    setError("");
    setProgress({ done: 0, total: files.length });
    let added = 0;
    for (const file of files) {
      let result;
      try {
        result = await uploadOne(match.id, file);
      } catch (problem) {
        result = { ok: false, error: problem.message };
      }
      if (!result.ok) {
        setError(result.error);
        break;
      }
      added += 1;
      setProgress({ done: added, total: files.length });
    }
    setProgress(null);
    await load();
  };

  const remove = async (photo, index) => {
    if (!window.confirm(`Remove photo ${index + 1}? You can take another one after.`)) return;
    setError("");
    const result = await liveApi(`/api/admin/live/photos/${photo.id}`, { method: "DELETE" });
    if (!result.ok) setError(result.error);
    await load();
  };

  if (!live && !open) {
    return (
      <div className="border-t border-line pt-4">
        <button type="button" className="btn btn-outline btn-sm" aria-expanded="false" aria-controls={idPrefix} onClick={() => setOpen(true)}>
          Photos ({count} of {required})
        </button>
      </div>
    );
  }

  const busy = Boolean(progress);
  return (
    <section id={idPrefix} className="space-y-3 border-t border-line pt-4" aria-labelledby={`${idPrefix}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id={`${idPrefix}-title`} className="text-sm font-semibold text-ink">
          Match photos <span className={`tabular-nums ${remaining === 0 ? "text-brand-primary" : "text-ink-soft"}`}>{shown} of {required}</span>
        </h4>
        {!live && <button type="button" className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline" onClick={() => setOpen(false)}>Hide photos</button>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ivory-dark" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-primary transition-[width]" style={{ width: `${Math.min(100, (shown / required) * 100)}%` }} />
      </div>
      {live && remaining > 0 && (
        <p className="text-sm text-ink-soft">
          Take {remaining} more photo{remaining === 1 ? "" : "s"} of this {match.kind === "versus" ? "match" : "event"}{isSuper ? "." : " before you can finish it."} They go to the Sports SAC&apos;s folder of each IIIT playing.
        </p>
      )}

      {photos === null ? (
        <p className="meta">Loading photos…</p>
      ) : photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <a href={`/api/admin/live/photos/${photo.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-control border border-line bg-ivory-dark">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-in image route */}
                <img src={`/api/admin/live/photos/${photo.id}?size=thumb`} alt={`Photo ${index + 1}${photo.uploadedBy ? `, by ${photo.uploadedBy}` : ""}`} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
              {canRemove && (
                <button type="button" disabled={busy} onClick={() => remove(photo, index)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-50"
                  aria-label={`Remove photo ${index + 1}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && remaining > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input ref={cameraRef} id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galleryRef} id={`${idPrefix}-gallery`} type="file" accept="image/jpeg,image/png,image/*" multiple className="sr-only" tabIndex={-1}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => cameraRef.current?.click()}>
            Take photo
          </button>
          <button type="button" className="btn btn-outline w-full sm:w-auto" disabled={busy} onClick={() => galleryRef.current?.click()}>
            Choose from gallery{remaining > 1 ? ` (up to ${remaining})` : ""}
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className={progress ? "text-sm font-semibold text-ink" : "sr-only"}>
        {progress ? `Uploading photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : ""}
      </p>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}
