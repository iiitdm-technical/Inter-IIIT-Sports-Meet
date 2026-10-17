"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getCategoryLabel, getEventName, getRegistrationFee, getSportName } from "@/lib/registration/labels";
import { useRouter } from "next/navigation";
import { getAllSportsList } from "@/lib/sports/config";
import useModalFocus from "@/components/useModalFocus";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState("entries");
  const [registrationsOverview, setRegistrationsOverview] = useState([]);
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [verificationTarget, setVerificationTarget] = useState(null);
  const [verificationUtr, setVerificationUtr] = useState("");
  const [verificationAmount, setVerificationAmount] = useState("");
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [entriesError, setEntriesError] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Entries search filters & data
  const [entriesData, setEntriesData] = useState({ rows: [], total: 0, page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({
    iiit: "",
    sport: "",
    event: "",
    gender: "",
    rollNumber: "",
    name: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [entriesLoading, setEntriesLoading] = useState(false);

  const sportsList = getAllSportsList();

  // sport.events is { M: [...], F: [...] } for individual sports, undefined for team sports.
  // Flatten all gender sub-arrays and deduplicate by event id so .map() always gets an array.
  const availableEvents = (() => {
    if (!filters.sport) return [];
    const sport = sportsList.find(s => s.id === filters.sport);
    if (!sport?.events) return [];
    const seen = new Set();
    return Object.values(sport.events).flat().filter(ev => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    });
  })();


  const loadEntries = useCallback(async (page = 1, activeFilters = {}) => {
    setEntriesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "25");
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value) params.set(key, value);
      }

      const res = await fetch(`/api/admin/entries?${params.toString()}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setEntriesData(data.data);
      setEntriesError("");
    } catch (err) {
      console.error("Failed to filter entries:", err);
      setEntriesError("Could not load entries. Check your connection and try again.");
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    const statsRes = await fetch("/api/admin/stats");
    if (!statsRes.ok) throw new Error("Could not load statistics");
    const sData = await statsRes.json();
    setStats(sData.data || null);
  }, []);

  useEffect(() => {
    async function checkAuthAndLoadData() {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          router.push("/login");
          return;
        }

        const authData = await authRes.json();

        // Null-safe check and authorization
        if (!authData || !authData.user || authData.user.role !== "admin") {
          router.push("/login");
          return;
        }

        setCurrentUser(authData.user);

        // Load each panel independently so one failure does not hide the rest.
        const failures = [];
        await Promise.all([
          refreshStats().catch(() => failures.push("statistics")),
          fetch("/api/admin/registrations").then(async (regRes) => {
            if (!regRes.ok) throw new Error();
            setRegistrationsOverview((await regRes.json()).data || []);
          }).catch(() => failures.push("IIITs and payments")),
          fetch("/api/admin/accounts").then(async (accountsRes) => {
            if (!accountsRes.ok) throw new Error();
            setAdminAccounts((await accountsRes.json()).data || []);
          }).catch(() => failures.push("admin accounts")),
        ]);
        if (failures.length > 0) setLoadError(`Could not load ${failures.join(", ")}. Reload the page to try again.`);
        loadEntries(1, {});
      } catch (err) {
        console.error("Failed to load admin data:", err);
        setLoadError("Could not load the dashboard. Reload the page to try again.");
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadData();
  }, [router, loadEntries, refreshStats]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    loadEntries(1, nextFilters);
  };

  // Export exactly what the table shows: the applied filters, not unsubmitted edits.
  const downloadMasterCsv = (useFilters = false) => {
    const params = new URLSearchParams();
    if (useFilters) {
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value) params.set(key, value);
      }
    }
    const downloadUrl = `/api/admin/csv?${params.toString()}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    router.push("/login");
  };

  const closeVerification = useCallback(() => {
    if (!verificationBusy) setVerificationTarget(null);
  }, [verificationBusy]);
  const verificationPanelRef = useModalFocus(Boolean(verificationTarget), closeVerification);

  const viewIiitEntries = (row) => {
    // The IIIT code matches exactly; a name such as "IIIT Kota" would also match "IIIT Kottayam".
    const nextFilters = { iiit: row.iiitCode, sport: "", event: "", gender: "", rollNumber: "", name: "" };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setActiveTab("entries");
    loadEntries(1, nextFilters);
  };

  const openVerification = (row) => {
    setVerificationTarget(row);
    setVerificationUtr("");
    setVerificationAmount("");
    setBankConfirmed(false);
    setVerificationError("");
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verificationTarget || verificationBusy) return;
    setVerificationBusy(true);
    setVerificationError("");
    try {
      const response = await fetch("/api/admin/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iiitCode: verificationTarget.iiitCode,
          transactionId: verificationUtr,
          amount: Number(verificationAmount),
          bankConfirmed,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not verify payment");
      setRegistrationsOverview((current) => current.map((row) => row.iiitCode === verificationTarget.iiitCode
        ? { ...row, paymentVerificationStatus: result.data.verificationStatus, paymentVerifiedAt: result.data.verifiedAt, paymentVerifiedBy: result.data.verifiedBy }
        : row));
      setVerificationTarget(null);
      refreshStats().catch(() => {});
    } catch (error) {
      setVerificationError(error.message || "Could not verify payment");
    } finally {
      setVerificationBusy(false);
    }
  };

  const paymentStage = (row) => {
    if (!row.status) return "not_submitted";
    if (row.status === "payment_pending") return "awaiting_payment";
    return row.paymentVerificationStatus === "verified" ? "verified" : "awaiting_verification";
  };
  const stageCounts = registrationsOverview.reduce((counts, row) => {
    const stage = paymentStage(row);
    counts[stage] = (counts[stage] || 0) + 1;
    return counts;
  }, {});
  const filteredRegistrations = paymentFilter === "all"
    ? registrationsOverview
    : registrationsOverview.filter((row) => paymentStage(row) === paymentFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center gap-3" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink-soft">Loading the admin dashboard…</p>
      </div>
    );
  }

  const tableHead = "sticky top-0 z-[1] border-b border-line bg-ivory px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted";
  const filterLabel = "mb-1.5 block text-sm font-semibold text-ink";
  const filterControl = "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:bg-ivory disabled:text-ink-muted";

  return (
    <div className="min-h-screen bg-ivory pb-16">
      {/* Header */}
      <header className="bg-brand-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href="/" className="shrink-0 rounded text-sm font-semibold text-brand-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-highlight">
              <span aria-hidden="true">←</span> Home
            </Link>
            <div className="min-w-0 border-l border-white/20 pl-3 sm:pl-4">
              <span className="block font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#e6c46a]" aria-hidden="true">Organizers</span>
              <h1 className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">
                Admin Dashboard
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/75 sm:block">
              Logged in as <strong className="font-semibold text-white">{currentUser?.displayName || currentUser?.email || currentUser?.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              type="button"
              className="btn btn-on-dark btn-sm whitespace-nowrap"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loadError && (
          <div role="alert" className="mb-6 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{loadError}</div>
        )}

        {/* KPI Cards */}
        {stats && (
          <dl className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="card card-accent p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Rosters locked</dt>
              <dd className="mt-2 flex items-baseline gap-1.5">
                <span className="stat-number text-5xl text-brand-primary">{stats.lockedIIITs}</span>
                <span className="font-display text-xl font-semibold text-ink-muted">/ {stats.totalIIITs}</span>
              </dd>
            </div>
            <div className="card p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Payments verified</dt>
              <dd className="mt-2 flex items-baseline gap-1.5">
                <span className="stat-number text-5xl text-brand-primary">{stats.paymentsVerified}</span>
                <span className="font-display text-xl font-semibold text-ink-muted">/ {stats.lockedIIITs}</span>
              </dd>
              {stats.paymentsSubmitted > stats.paymentsVerified && (
                <dd className="mt-2"><span className="chip chip-gold">{stats.paymentsSubmitted - stats.paymentsVerified} awaiting verification</span></dd>
              )}
            </div>
            <div className="card p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Unique students</dt>
              <dd className="stat-number mt-2 text-5xl text-ink">{stats.totalStudents}</dd>
            </div>
            <div className="card p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Event entries</dt>
              <dd className="stat-number mt-2 text-5xl text-ink">{stats.totalEventEntries}</dd>
            </div>
          </dl>
        )}

        {/* Tab Nav */}
        <div role="tablist" aria-label="Dashboard sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
          {[["entries", "Registration Entries"], ["payments", "IIITs & Payments"], ["admins", "Admin Accounts"]].map(([tab, tabLabel]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px whitespace-nowrap border-b-[3px] px-4 py-3 font-display text-lg font-bold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary ${
                activeTab === tab
                  ? "border-brand-highlight text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tabLabel}
            </button>
          ))}
        </div>

        {/* Filter Controls and Export */}
        {activeTab === "entries" && (
        <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Locked rosters</p>
            <h2 className="heading-section mt-1 text-[2rem]">
              Registration Entries
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadMasterCsv(false)}
              className="btn btn-outline btn-sm"
            >
              Export All
            </button>
            <button
              type="button"
              onClick={() => downloadMasterCsv(true)}
              className="btn btn-accent btn-sm"
            >
              Export Current Filter →
            </button>
          </div>
        </div>
        )}

        {activeTab === "entries" && (
        <div className="card mb-6 p-5">
          <form onSubmit={handleSearchSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label htmlFor="filter-iiit" className={filterLabel}>IIIT</label>
                <input
                  id="filter-iiit"
                  type="text"
                  value={filters.iiit}
                  onChange={(e) => setFilters({ ...filters, iiit: e.target.value })}
                  placeholder="Name or code, e.g. Gwalior"
                  className={filterControl}
                />
              </div>
              <div>
                <label htmlFor="filter-sport" className={filterLabel}>Sport</label>
                <select
                  id="filter-sport"
                  value={filters.sport}
                  onChange={(e) => setFilters({ ...filters, sport: e.target.value, event: "" })}
                  className={filterControl}
                >
                  <option value="">All Sports</option>
                  {sportsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-event" className={filterLabel}>Event</label>
                <select
                  id="filter-event"
                  value={filters.event}
                  onChange={(e) => setFilters({ ...filters, event: e.target.value })}
                  disabled={!filters.sport || availableEvents.length === 0}
                  className={filterControl}
                >
                  <option value="">All Events</option>
                  {availableEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-gender" className={filterLabel}>Gender</label>
                <select
                  id="filter-gender"
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className={filterControl}
                >
                  <option value="">All</option>
                  <option value="M">Men (M)</option>
                  <option value="F">Women (F)</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-roll" className={filterLabel}>Roll Number</label>
                <input
                  id="filter-roll"
                  type="text"
                  value={filters.rollNumber}
                  onChange={(e) => setFilters({ ...filters, rollNumber: e.target.value })}
                  placeholder="e.g. 22CS101"
                  className={filterControl}
                />
              </div>
              <div>
                <label htmlFor="filter-name" className={filterLabel}>Student Name</label>
                <input
                  id="filter-name"
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  placeholder="e.g. Rahul"
                  className={filterControl}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => {
                  setFilters({ iiit: "", sport: "", event: "", gender: "", rollNumber: "", name: "" });
                  setAppliedFilters({});
                  loadEntries(1, {});
                }}
                className="btn btn-outline btn-sm"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={entriesLoading}
                className="btn btn-primary btn-sm px-5"
              >
                {entriesLoading ? "Searching..." : "Apply Filters"}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Entries Table */}
        {activeTab === "entries" && (
        <div className="card overflow-hidden">
          {entriesError && (
            <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{entriesError}</div>
          )}
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm text-ink-soft" aria-live="polite">
            <span className="font-semibold text-ink">Matching Entries: {entriesData.total || 0}</span>
            {entriesData.totalPages > 0 && (
              <span className="meta">Page {entriesData.page} of {entriesData.totalPages}</span>
            )}
          </div>
          <div className="max-h-[70vh] overflow-auto" tabIndex={0} role="region" aria-label="Registration entries table">
            <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className={`${tableHead}`}>IIIT Name</th>
                  <th scope="col" className={`${tableHead}`}>Sport</th>
                  <th scope="col" className={`${tableHead}`}>Event</th>
                  <th scope="col" className={`${tableHead}`}>Category</th>
                  <th scope="col" className={`${tableHead}`}>Role</th>
                  <th scope="col" className={`${tableHead} text-center`}>Gender</th>
                  <th scope="col" className={`${tableHead}`}>Roll Number</th>
                  <th scope="col" className={`${tableHead} w-full`}>Student Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-paper">
                {!entriesData.rows || entriesData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-ink-muted">
                      {entriesLoading ? "Searching database..." : (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-ink-muted/50" fill="none" aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No locked entries found matching your criteria.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  entriesData.rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-ivory/80">
                      <td className="max-w-[200px] truncate px-4 py-3 font-semibold text-ink" title={row.iiitName}>{row.iiitName}</td>
                      <td className="px-4 py-3 font-medium text-ink">{getSportName(row.sportId)}</td>
                      <td className="px-4 py-3 text-ink-soft">{getEventName(row.sportId, row.eventId, row.eventGender)}</td>
                      <td className="px-4 py-3 text-ink-soft">{getCategoryLabel(row.eventGender)}</td>
                      <td className="px-4 py-3">{row.isReserve ? <span className="chip chip-gold">Reserve</span> : <span className="text-ink-muted">Main</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`chip ${row.studentGender === 'F' ? 'chip-gold' : ''}`}>
                          {row.studentGender}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-soft">{row.rollNumber}</td>
                      <td className="truncate px-4 py-3 font-semibold text-ink">{row.studentName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {entriesData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line bg-ivory px-4 py-3 text-sm">
              <button
                disabled={entriesData.page <= 1}
                onClick={() => loadEntries(entriesData.page - 1, appliedFilters)}
                className="btn btn-outline btn-sm"
              >
                &larr; Previous
              </button>
              <span className="font-medium text-ink-soft">Page {entriesData.page} of {entriesData.totalPages}</span>
              <button
                disabled={entriesData.page >= entriesData.totalPages}
                onClick={() => loadEntries(entriesData.page + 1, appliedFilters)}
                className="btn btn-outline btn-sm"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
        )}

        {/* IIITs & Payments Tab */}
        {activeTab === "payments" && (
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-ink">
                {registrationsOverview.length} IIIT accounts · {registrationsOverview.filter(r => r.isSubmitted).length} rosters locked
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="payment-filter" className="text-sm font-semibold text-ink">Show</label>
                <select
                  id="payment-filter"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="rounded-control border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="all">All IIITs ({registrationsOverview.length})</option>
                  <option value="awaiting_verification">Awaiting verification ({stageCounts.awaiting_verification || 0})</option>
                  <option value="awaiting_payment">Awaiting payment ({stageCounts.awaiting_payment || 0})</option>
                  <option value="verified">Verified ({stageCounts.verified || 0})</option>
                  <option value="not_submitted">Not submitted ({stageCounts.not_submitted || 0})</option>
                </select>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto" tabIndex={0} role="region" aria-label="IIITs and payments table">
              <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={`${tableHead}`}>IIIT</th>
                    <th scope="col" className={`${tableHead}`}>Contact</th>
                    <th scope="col" className={`${tableHead} text-center`}>Status</th>
                    <th scope="col" className={`${tableHead} text-center`}>Students</th>
                    <th scope="col" className={`${tableHead} text-center`}>Amount</th>
                    <th scope="col" className={`${tableHead}`}>Mode</th>
                    <th scope="col" className={`${tableHead} text-center`}>Payment</th>
                    <th scope="col" className={`${tableHead}`}>Transaction ID</th>
                    <th scope="col" className={`${tableHead}`}>Date</th>
                    <th scope="col" className={`${tableHead}`}>Bank</th>
                    <th scope="col" className={`${tableHead} text-center`}>Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-paper">
                  {filteredRegistrations.map((row) => (
                    <tr key={row.iiitCode || row.iiitName} className="transition-colors hover:bg-ivory/80">
                      <td className="px-4 py-3 align-top">
                        <div className="max-w-[180px] truncate font-semibold text-ink" title={row.iiitName}>{row.iiitName}</div>
                        {row.isSubmitted && (
                          <button type="button" onClick={() => viewIiitEntries(row)} className="mt-1 text-sm font-semibold text-brand-primary underline underline-offset-2 hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
                            View entries<span className="sr-only"> for {row.iiitName}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-ink-soft">
                        {row.contactName ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-ink">{row.contactName}</div>
                            {row.contactEmail && <a href={`mailto:${row.contactEmail}`} className="block text-brand-primary underline underline-offset-2">{row.contactEmail}</a>}
                            {row.contactPhone && <a href={`tel:${row.contactPhone.replace(/[^+0-9]/g, "")}`} className="block text-ink-soft underline underline-offset-2">{row.contactPhone}</a>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status
                          ? <span className="chip">Roster locked</span>
                          : <span className="chip bg-ivory-dark text-ink-soft">Not submitted</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-ink">{row.isSubmitted ? row.totalStudentsCount : "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold text-ink">
                        {row.paymentAmount
                          ? `₹${Number(row.paymentAmount).toLocaleString("en-IN")}`
                          : row.status === "payment_pending"
                          ? `₹${getRegistrationFee(row.totalStudentsCount).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.paymentMode === "OTHER" ? row.otherPaymentMode : (row.paymentMode || "—")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status === "submitted"
                          ? <div className="flex flex-col items-center gap-2">
                              <span className={`chip ${row.paymentVerificationStatus === "verified" ? "" : "chip-gold"}`}>
                                {row.paymentVerificationStatus === "verified" ? "Bank Verified" : "Proof Submitted"}
                              </span>
                              {row.paymentVerificationStatus !== "verified" && row.paymentProofPathname && (
                                <button type="button" onClick={() => openVerification(row)} className="btn btn-primary btn-sm">
                                  Verify payment
                                </button>
                              )}
                            </div>
                          : row.status === "payment_pending"
                          ? <span className="chip chip-gold">Awaiting proof</span>
                          : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 font-mono text-ink-soft">{row.paymentTransactionId || "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {row.paymentTransactionDate
                          ? new Date(row.paymentTransactionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-ink-soft">{row.paymentBankName || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {row.paymentProofPathname ? (
                          <a
                            href={`/api/payment/proof?iiitCode=${row.iiitCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View<span className="sr-only"> payment proof for {row.iiitName}</span>
                          </a>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRegistrations.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-ink-soft">No IIITs match this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "admins" && (
          <section className="card overflow-hidden" aria-labelledby="admin-accounts-title">
            <div className="border-b border-line px-5 py-4">
              <h2 id="admin-accounts-title" className="heading-section text-[1.75rem]">Admin accounts</h2>
              <p className="mt-1 text-sm text-ink-soft">These accounts can view private proofs and verify bank payments. Accounts are added manually by an organizer.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-ivory text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  <tr><th scope="col" className="px-5 py-3">Name</th><th scope="col" className="px-5 py-3">Email</th><th scope="col" className="px-5 py-3">Username</th><th scope="col" className="px-5 py-3">Added</th></tr>
                </thead>
                <tbody className="divide-y divide-line bg-paper">
                  {adminAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="px-5 py-3 font-semibold text-ink">{account.displayName || "—"}</td>
                      <td className="px-5 py-3 text-ink-soft">{account.email || "Legacy account — no email"}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{account.username}</td>
                      <td className="px-5 py-3 text-ink-muted">{new Date(account.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {verificationTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/75 p-4 backdrop-blur-[2px]" onClick={(event) => { if (event.target === event.currentTarget) closeVerification(); }}>
            <form ref={verificationPanelRef} onSubmit={submitVerification} role="dialog" aria-modal="true" aria-labelledby="verify-payment-title" tabIndex={-1} className="w-full max-w-lg rounded-card border border-line bg-paper p-6 shadow-lift outline-none">
              <p className="eyebrow">Payment check</p>
              <h2 id="verify-payment-title" className="heading-section mt-1 text-[2rem]">Verify bank transfer</h2>
              <p className="mt-2 text-sm text-ink-soft">{verificationTarget.iiitName} submitted a proof for ₹{Number(verificationTarget.paymentAmount).toLocaleString("en-IN")}. Check the bank statement before confirming receipt.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="verify-utr" className="block text-sm font-semibold text-ink">UTR shown on bank statement</label>
                  <input id="verify-utr" value={verificationUtr} onChange={(event) => setVerificationUtr(event.target.value)} required className="mt-1.5 w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink font-mono focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                </div>
                <div>
                  <label htmlFor="verify-amount" className="block text-sm font-semibold text-ink">Amount received (₹)</label>
                  <input id="verify-amount" type="number" min="1" step="1" value={verificationAmount} onChange={(event) => setVerificationAmount(event.target.value)} required className="mt-1.5 w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                </div>
                <label className="flex items-start gap-3 rounded-control border border-amber-300 bg-gold-wash p-3 text-sm font-medium text-ink">
                  <input type="checkbox" checked={bankConfirmed} onChange={(event) => setBankConfirmed(event.target.checked)} required className="mt-1 size-4 accent-brand-primary" />
                  I matched the UTR and amount to an actual credit in the organizer&apos;s bank account.
                </label>
              </div>
              {verificationError && <p role="alert" className="mt-4 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{verificationError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeVerification} disabled={verificationBusy} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={verificationBusy || !bankConfirmed} className="btn btn-primary">{verificationBusy ? "Verifying…" : "Mark verified"}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
