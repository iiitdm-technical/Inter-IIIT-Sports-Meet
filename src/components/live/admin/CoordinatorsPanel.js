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
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows([...rows, { sportId: "", gender: "all" }])}>Add another sport</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(sports.map((sport) => ({ sportId: sport.id, gender: "all" })))}>All sports</button>
      </div>
    </fieldset>
  );
}

function Credentials({ username, password, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `Live results sign-in${name ? ` for ${name}` : ""}\n${window.location.origin}/login\nUsername: ${username}\nPassword: ${password}`;
  return (
    <div role="status" className="rounded-card border border-green-200 bg-green-wash p-4 text-sm text-ink">
      <p className="font-semibold">Share these sign-in details with {name || "the coordinator"}.</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-muted">Sign in at</dt><dd className="break-all">{window.location.origin}/login</dd>
        <dt className="text-ink-muted">Username</dt><dd className="break-all font-semibold">{username}</dd>
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

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function checkPassword(password) {
  if (password.length < 8) return "Use at least 8 characters for the password";
  if (password !== password.trim()) return "The password cannot start or end with a space";
  return "";
}

function PasswordInput({ id, value, onChange }) {
  const [shown, setShown] = useState(true);
  return (
    <div className="flex gap-2">
      <input id={id} type={shown ? "text" : "password"} className={fieldControl} minLength={8} maxLength={128} autoComplete="new-password" spellCheck={false} autoCapitalize="none"
        value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`} />
      <button type="button" className="btn btn-outline btn-sm shrink-0" aria-pressed={!shown} onClick={() => setShown(!shown)}>{shown ? "Hide" : "Show"}</button>
    </div>
  );
}

const validRows = (rows) => rows.filter((row) => row.sportId);

/** Super admin: add coordinators, change their sports, set passwords, remove access. */
export default function CoordinatorsPanel({ sports, onNotice }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [rows, setRows] = useState([{ sportId: "", gender: "all" }]);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);
  const [editing, setEditing] = useState(null); // { id, rows }
  const [passwordFor, setPasswordFor] = useState(null); // { id, value }

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
    const username = form.username.trim().toLowerCase();
    if (!form.name.trim()) return setError("Enter the coordinator's name");
    if (!USERNAME_PATTERN.test(username)) return setError("Choose a username of 3–32 letters, digits, dots, dashes or underscores, e.g. football-boys");
    const passwordProblem = checkPassword(form.password);
    if (passwordProblem) return setError(passwordProblem);
    if (!validRows(rows).length) return setError("Assign at least one sport");
    setBusy(true);
    const result = await liveApi("/api/admin/live/coordinators", { method: "POST", body: { username, password: form.password, name: form.name.trim(), sports: validRows(rows) } });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setIssued({ username: result.data.username, password: form.password, name: form.name.trim() });
    setForm({ username: "", password: "", name: "" });
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

  const savePassword = async (person) => {
    const problem = checkPassword(passwordFor.value);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    const result = await liveApi(`/api/admin/live/coordinators/${person.id}`, { method: "POST", body: { password: passwordFor.value } });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setIssued({ username: person.username, password: passwordFor.value, name: person.displayName });
    setPasswordFor(null);
  };

  const remove = async (person) => {
    if (!window.confirm(`Remove ${person.displayName || person.username}? They lose access straight away. Their past score updates and photos stay.`)) return;
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
                    <p className="font-semibold text-ink">{person.displayName || person.username}</p>
                    <p className="meta break-all">Username: <span className="font-semibold text-ink-soft">{person.username}</span>{person.email && person.email !== person.username ? ` · ${person.email}` : ""}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Sports">
                      {person.sports.map((item) => (
                        <li key={`${item.sportId}-${item.gender}`} className="chip">{item.sportName}{item.gender !== "all" ? ` · ${genderLabel(item.gender)}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing({ id: person.id, rows: person.sports.map(({ sportId, gender }) => ({ sportId, gender })) })}>Change sports</button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} aria-expanded={passwordFor?.id === person.id} onClick={() => setPasswordFor(passwordFor?.id === person.id ? null : { id: person.id, value: "" })}>Change password</button>
                    <button type="button" className="btn btn-outline btn-sm border-red-300 text-red-700" disabled={busy} onClick={() => remove(person)}>Remove</button>
                  </div>
                </div>
                {passwordFor?.id === person.id && (
                  <form className="mt-3 space-y-2 rounded-card bg-ivory-dark p-3" onSubmit={(e) => { e.preventDefault(); savePassword(person); }}>
                    <label htmlFor={`password-${person.id}`} className={fieldLabel}>New password for {person.displayName || person.username}</label>
                    <PasswordInput id={`password-${person.id}`} value={passwordFor.value} onChange={(value) => setPasswordFor({ id: person.id, value })} />
                    <p id={`password-${person.id}-hint`} className="meta">At least 8 characters. They are signed out and must use the new password.</p>
                    <div className="flex gap-2">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save password</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setPasswordFor(null)}>Cancel</button>
                    </div>
                  </form>
                )}
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
        <p className="meta mt-1">Make one account per sport (or per volunteer). They sign in at /login with the username and password you set here, and can only update the sports you choose.</p>
        <form onSubmit={create} className="mt-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="coordinator-name" className={fieldLabel}>Name</label>
              <input id="coordinator-name" className={fieldControl} maxLength={128} autoComplete="off" placeholder="e.g. Football volunteers" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="coordinator-username" className={fieldLabel}>Username</label>
              <input id="coordinator-username" className={fieldControl} maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="e.g. football" aria-describedby="coordinator-username-hint"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "-") })} />
              <p id="coordinator-username-hint" className="meta mt-1">Letters, digits, dots or dashes.</p>
            </div>
            <div>
              <label htmlFor="coordinator-password" className={fieldLabel}>Password</label>
              <PasswordInput id="coordinator-password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
              <p id="coordinator-password-hint" className="meta mt-1">At least 8 characters, e.g. Football@2026.</p>
            </div>
          </div>
          <AssignmentRows rows={rows} setRows={setRows} sports={sports} idPrefix="new-coordinator" />
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add coordinator"}</button>
        </form>
      </section>
    </div>
  );
}
