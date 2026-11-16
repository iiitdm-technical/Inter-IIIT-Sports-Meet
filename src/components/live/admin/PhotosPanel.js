"use client";

import { useCallback, useEffect, useState } from "react";
import { formatWhen, genderLabel, stageLabel } from "@/lib/live/format";
import { liveApi } from "./api";

const MB = 1024 * 1024;

function matchLabel(match) {
  return match.kind === "event"
    ? match.eventName
    : `${match.sideA?.name || "To be decided"} vs ${match.sideB?.name || "To be decided"}`;
}

function Folder({ code, onBack }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let active = true;
    liveApi(`/api/admin/live/photos?iiit=${encodeURIComponent(code)}`).then((result) => {
      if (active) setState({ loading: false, data: result.ok ? result.data : null, error: result.ok ? "" : result.error });
    });
    return () => { active = false; };
  }, [code]);

  const total = state.data?.matches.reduce((sum, item) => sum + item.photos.length, 0) || 0;
  return (
    <section className="space-y-4" aria-labelledby="photo-folder-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline" onClick={onBack}>
            <span aria-hidden="true">←</span> All IIITs
          </button>
          <h3 id="photo-folder-title" className="heading-card mt-1">{state.data?.iiitName || "Photos"}</h3>
          {state.data && <p className="meta">{total} photo{total === 1 ? "" : "s"} from {state.data.matches.length} match{state.data.matches.length === 1 ? "" : "es"}</p>}
        </div>
        {total > 0 && (
          <a className="btn btn-primary btn-sm" href={`/api/admin/live/photos/zip?iiit=${encodeURIComponent(code)}`} download>
            Download all ({total}) as zip
          </a>
        )}
      </div>
      {state.loading && <p className="meta">Loading…</p>}
      {state.error && <p role="alert" className="text-sm font-semibold text-red-700">{state.error}</p>}
      {state.data && state.data.matches.length === 0 && (
        <p className="card-tint rounded-card px-4 py-5 text-sm text-ink-soft">No photos for this IIIT yet. They appear here as volunteers upload them during matches.</p>
      )}
      {state.data?.matches.map(({ match, photos }) => (
        <article key={match.id} className="card p-4" aria-labelledby={`photo-match-${match.id}`}>
          <h4 id={`photo-match-${match.id}`} className="font-display text-base font-bold uppercase leading-tight text-ink">{matchLabel(match)}</h4>
          <p className="meta mt-0.5">
            {[match.sportName, genderLabel(match.gender), stageLabel(match), match.scheduledAt ? formatWhen(match.scheduledAt) : ""].filter(Boolean).join(" · ")}
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <a href={`/api/admin/live/photos/${photo.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-control border border-line bg-ivory-dark">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-in image route */}
                  <img src={`/api/admin/live/photos/${photo.id}?size=thumb`} alt={`${matchLabel(match)}, photo ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                </a>
                <p className="mt-1 truncate text-xs text-ink-muted" title={photo.uploadedBy || ""}>{photo.uploadedBy || "—"}</p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

/** Sports SAC: match photos sorted into one folder per IIIT, each downloadable as a zip. */
export default function PhotosPanel() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState("");

  const load = useCallback(async () => {
    const result = await liveApi("/api/admin/live/photos");
    if (result.ok) setSummary(result.data);
    else setError(result.error);
  }, []);

  // load() only sets state after its request finishes.
  useEffect(() => { if (!open) load(); }, [open, load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (open) return <Folder code={open} onBack={() => setOpen("")} />;

  const used = summary ? summary.totalBytes / MB : 0;
  const cap = summary ? summary.capBytes / MB : 0;
  const withPhotos = summary?.folders.filter((folder) => folder.photos > 0) || [];
  const empty = summary?.folders.filter((folder) => folder.photos === 0) || [];

  return (
    <section className="space-y-4" aria-labelledby="photos-title">
      <div>
        <h3 id="photos-title" className="heading-card">Match photos by IIIT</h3>
        <p className="meta mt-1">
          Volunteers upload {summary?.required ?? 5} photos of every match. Each photo is filed under both IIITs in the match (every placed IIIT for events). Only you and the sport&apos;s coordinators can see them.
        </p>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      {!summary && !error && <p className="meta">Loading…</p>}
      {summary && (
        <>
          <p className="card-tint rounded-card px-4 py-3 text-sm text-ink-soft">
            {summary.totalPhotos} photo{summary.totalPhotos === 1 ? "" : "s"} · {used.toFixed(1)} MB of the {Math.round(cap)} MB set aside for photos
            {summary.unassigned > 0 && ` · ${summary.unassigned} from events without placings yet (they appear in folders once placings are entered)`}
          </p>
          {withPhotos.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {withPhotos.map((folder) => (
                <li key={folder.iiitCode}>
                  <button type="button" onClick={() => setOpen(folder.iiitCode)} className="card flex w-full items-center justify-between gap-3 p-4 text-left hover:ring-2 hover:ring-brand-primary/30">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{folder.iiitName}</span>
                      <span className="meta">{folder.matches} match{folder.matches === 1 ? "" : "es"}</span>
                    </span>
                    <span className="chip shrink-0 tabular-nums">{folder.photos} photo{folder.photos === 1 ? "" : "s"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {empty.length > 0 && (
            <p className="meta">
              No photos yet: {empty.map((folder) => folder.iiitName).join(", ")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
