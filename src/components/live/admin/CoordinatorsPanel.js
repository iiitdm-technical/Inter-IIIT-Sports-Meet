"use client";

import { useCallback, useEffect, useState } from "react";
import { genderLabel } from "@/lib/live/format";
import { fieldControl, fieldLabel, liveApi } from "./api";

function AssignmentRows({ rows, setRows, sports, idPrefix }) {
  const update = (index, key, value) => setRows(rows.map((row, i) => (i === index ? { ...row, [key]: value, ...(key === "sportId" ? { gender: "all" } : {}) } : row)));
  return (
    <fieldset className="space-y-2">
      <legend className={fieldLabel}>Sports they can update</legend>
      {rows.map((row, index) => {
        const sport = sports.find((item) => item.id === row.sportId);
        return (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <div>
              <label htmlFor={`${idPrefix}-s${index}`} className="sr-only">Sport {index + 1}</label>
              <select id={`${idPrefix}-s${index}`} className={fieldControl} value={row.sportId} onChange={(e) => update(index, "sportId", e.target.value)}>
                <option value="">Choose a sport</option>
                {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-g${index}`} className="sr-only">Category for sport {index + 1}</label>
              <select id={`${idPrefix}-g${index}`} className={fieldControl} value={row.gender} disabled={!sport} onChange={(e) => update(index, "gender", e.target.value)}>
                <option value="all">All categories</option>
                {(sport?.genders || []).map((gender) => <option key={gender} value={gender}>{genderLabel(gender)} only</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-outline btn-sm" disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} aria-label={`Remove sport ${index + 1}`}>Remove</button>
          </div>
        );
      })}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows([...rows, { sportId: "", gender: "all" }])}>Add another sport</button>
    </fieldset>
  );
}

function Credentials({ email, password, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `Live results sign-in\n${window.location.origin}/login\nEmail: ${email}\nPassword: ${password}`;
  return (
    <div role="status" className="rounded-card border border-green-200 bg-green-wash p-4 text-sm text-ink">
      <p className="font-semibold">Share these sign-in details with the coordinator. The password is shown only once.</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-muted">Email</dt><dd className="break-all font-semibold">{email}</dd>
        <dt className="text-ink-muted">Password</dt><dd className="font-mono text-base font-bold tracking-wide">{password}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
        }}>{copied ? "Copied" : "Copy sign-in details"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

const validRows = (rows) => rows.filter((row) => row.sportId);

/** Super admin: add coordinators, change their sports, reset passwords, remove access. */
export default function CoordinatorsPanel({ sports, onNotice }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", name: "" });
  const [rows, setRows] = useState([{ sportId: "", gender: "all" }]);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);
  const [editing, setEditing] = useState(null); // { id, rows }

  const load = useCallback(async () => {
    const result = await liveApi("/api/admin/live/coordinators");
    if (result.ok) setList(result.data);
    else setError(result.error);
  }, []);

  // load() only sets state after its request finishes.
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Enter the coordinator's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email");
    if (!validRows(rows).length) return setError("Assign at least one sport");
    setBusy(true);
    const result = await liveApi("/api/admin/live/coordinators", { method: "POST", body: { email: form.email.trim(), name: form.name.trim(), sports: validRows(rows) } });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setIssued({ email: result.data.email, password: result.data.password });
    setForm({ email: "", name: "" });
    setRows([{ sportId: "", gender: "all" }]);
    load();
  };

  const saveSports = async () => {
    if (!validRows(editing.rows).length) return setError("Assign at least one sport");
    setBusy(true);
    const result = await liveApi(`/api/admin/live/coordinators/${editing.id}`, { method: "PUT", body: { sports: validRows(editing.rows) } });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setEditing(null);
    onNotice("Sports updated");
    load();
  };

  const reset = async (person) => {
    if (!window.confirm(`Issue a new password for ${person.displayName || person.email}? The old one stops working and they are signed out.`)) return;
    setBusy(true);
    const result = await liveApi(`/api/admin/live/coordinators/${person.id}`, { method: "POST" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setIssued({ email: person.email, password: result.data.password });
  };

  const remove = async (person) => {
    if (!window.confirm(`Remove ${person.displayName || person.email}? They lose access straight away. Their past score updates stay in the history.`)) return;
    setBusy(true);
    const result = await liveApi(`/api/admin/live/coordinators/${person.id}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onNotice("Coordinator removed");
    load();
  };

  return (
    <div className="space-y-6">
      {issued && <Credentials {...issued} onClose={() => setIssued(null)} />}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}

      <section className="card p-4 sm:p-5" aria-labelledby="coordinators-list-title">
        <h3 id="coordinators-list-title" className="heading-card">Coordinators</h3>
        {list === null ? (
          <p className="meta mt-2">Loading…</p>
        ) : list.length === 0 ? (
          <p className="meta mt-2">No coordinators yet. Add one below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {list.map((person) => (
              <li key={person.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{person.displayName || person.email}</p>
                    <p className="meta break-all">{person.email}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Sports">
                      {person.sports.map((item) => (
                        <li key={`${item.sportId}-${item.gender}`} className="chip">{item.sportName}{item.gender !== "all" ? ` · ${genderLabel(item.gender)}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing({ id: person.id, rows: person.sports.map(({ sportId, gender }) => ({ sportId, gender })) })}>Change sports</button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => reset(person)}>New password</button>
                    <button type="button" className="btn btn-outline btn-sm border-red-300 text-red-700" disabled={busy} onClick={() => remove(person)}>Remove</button>
                  </div>
                </div>
                {editing?.id === person.id && (
                  <div className="mt-3 space-y-3 rounded-card bg-ivory-dark p-3">
                    <AssignmentRows rows={editing.rows} setRows={(next) => setEditing({ ...editing, rows: next })} sports={sports} idPrefix={`edit-${person.id}`} />
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveSports}>Save sports</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 sm:p-5" aria-labelledby="coordinator-add-title">
        <h3 id="coordinator-add-title" className="heading-card">Add a coordinator</h3>
        <p className="meta mt-1">They sign in at /login with their email and the password shown after you add them, and can only update the sports you choose.</p>
        <form onSubmit={create} className="mt-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="coordinator-name" className={fieldLabel}>Name</label>
              <input id="coordinator-name" className={fieldControl} maxLength={128} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="coordinator-email" className={fieldLabel}>Email</label>
              <input id="coordinator-email" type="email" className={fieldControl} maxLength={64} autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <AssignmentRows rows={rows} setRows={setRows} sports={sports} idPrefix="new-coordinator" />
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add coordinator"}</button>
        </form>
      </section>
    </div>
  );
}
