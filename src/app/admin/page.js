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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#faf6ee" }}>
        <div className="text-sm font-bold" style={{ color: "#0a2112" }}>
          Loading Admin Control Center...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#faf6ee" }}>
      {/* Header */}
      <header className="border-b" style={{ background: "#0a2112", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="shrink-0 text-xs font-bold text-[#f5c518] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c518]">
              <span aria-hidden="true">←</span> Home
            </Link>
            <span className="px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider" style={{ background: "#f5c518", color: "#0a2112" }} aria-hidden="true">
              Admin
            </span>
            <h1 className="text-white text-sm sm:text-base font-black tracking-wide truncate">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-xs font-medium text-gray-300">
              Logged in as <strong className="text-white">{currentUser?.displayName || currentUser?.email || currentUser?.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              type="button"
              className="whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-lg border border-white/25 text-white hover:bg-white/10 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c518]"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loadError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{loadError}</div>
        )}

        {/* KPI Cards */}
        {stats && (
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Rosters locked</dt>
              <dd className="text-3xl font-black mt-2 text-[#1b5e20]">
                {stats.lockedIIITs} <span className="text-lg text-gray-500">/ {stats.totalIIITs}</span>
              </dd>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Payments verified</dt>
              <dd className="text-3xl font-black mt-2 text-[#1b5e20]">
                {stats.paymentsVerified} <span className="text-lg text-gray-500">/ {stats.lockedIIITs}</span>
              </dd>
              {stats.paymentsSubmitted > stats.paymentsVerified && (
                <dd className="mt-1 text-xs font-bold text-amber-800">{stats.paymentsSubmitted - stats.paymentsVerified} awaiting verification</dd>
              )}
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Unique students</dt>
              <dd className="text-3xl font-black mt-2 text-[#0a2112]">{stats.totalStudents}</dd>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Event entries</dt>
              <dd className="text-3xl font-black mt-2 text-[#0a2112]">{stats.totalEventEntries}</dd>
            </div>
          </dl>
        )}

        {/* Tab Nav */}
        <div role="tablist" aria-label="Dashboard sections" className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {[["entries", "Registration Entries"], ["payments", "IIITs & Payments"], ["admins", "Admin Accounts"]].map(([tab, tabLabel]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold border-b-2 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1b5e20] ${
                activeTab === tab
                  ? "border-[#1b5e20] text-[#1b5e20]"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              {tabLabel}
            </button>
          ))}
        </div>

        {/* Filter Controls and Export */}
        {activeTab === "entries" && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-200 pb-4 mt-6">
          <div className="flex gap-2">
            <h2 className="text-lg font-black text-gray-900 tracking-wide">
              Registration Entries
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => downloadMasterCsv(false)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Export All
            </button>
            <button
              onClick={() => downloadMasterCsv(true)}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs hover:-translate-y-0.5"
              style={{ background: "#f5c518", color: "#0a2112" }}
            >
              Export Current Filter →
            </button>
          </div>
        </div>
        )}

        {activeTab === "entries" && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs mb-8">
          <form onSubmit={handleSearchSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label htmlFor="filter-iiit" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">IIIT</label>
                <input
                  id="filter-iiit"
                  type="text"
                  value={filters.iiit}
                  onChange={(e) => setFilters({ ...filters, iiit: e.target.value })}
                  placeholder="Name or code, e.g. Gwalior"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20]"
                />
              </div>
              <div>
                <label htmlFor="filter-sport" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">Sport</label>
                <select
                  id="filter-sport"
                  value={filters.sport}
                  onChange={(e) => setFilters({ ...filters, sport: e.target.value, event: "" })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20] bg-white"
                >
                  <option value="">All Sports</option>
                  {sportsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-event" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">Event</label>
                <select
                  id="filter-event"
                  value={filters.event}
                  onChange={(e) => setFilters({ ...filters, event: e.target.value })}
                  disabled={!filters.sport || availableEvents.length === 0}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20] bg-white disabled:opacity-50"
                >
                  <option value="">All Events</option>
                  {availableEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-gender" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">Gender</label>
                <select
                  id="filter-gender"
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20] bg-white"
                >
                  <option value="">All</option>
                  <option value="M">Men (M)</option>
                  <option value="F">Women (F)</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-roll" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">Roll Number</label>
                <input
                  id="filter-roll"
                  type="text"
                  value={filters.rollNumber}
                  onChange={(e) => setFilters({ ...filters, rollNumber: e.target.value })}
                  placeholder="e.g. 22CS101"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20]"
                />
              </div>
              <div>
                <label htmlFor="filter-name" className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">Student Name</label>
                <input
                  id="filter-name"
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  placeholder="e.g. Rahul"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setFilters({ iiit: "", sport: "", event: "", gender: "", rollNumber: "", name: "" });
                  setAppliedFilters({});
                  loadEntries(1, {});
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={entriesLoading}
                className="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-green-800 disabled:opacity-50"
                style={{ background: "#1b5e20" }}
              >
                {entriesLoading ? "Searching..." : "Apply Filters"}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Entries Table */}
        {activeTab === "entries" && (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
          {entriesError && (
            <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{entriesError}</div>
          )}
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center text-xs text-gray-600" aria-live="polite">
            <span className="font-bold">Matching Entries: {entriesData.total || 0}</span>
            {entriesData.totalPages > 0 && (
              <span>Page {entriesData.page} of {entriesData.totalPages}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">IIIT Name</th>
                  <th className="px-4 py-3">Sport</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-center">Gender</th>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3 w-full">Student Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!entriesData.rows || entriesData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      {entriesLoading ? "Searching database..." : (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No locked entries found matching your criteria.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  entriesData.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 truncate max-w-[200px]" title={row.iiitName}>{row.iiitName}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{getSportName(row.sportId)}</td>
                      <td className="px-4 py-3 text-gray-800">{getEventName(row.sportId, row.eventId, row.eventGender)}</td>
                      <td className="px-4 py-3 text-gray-700">{getCategoryLabel(row.eventGender)}</td>
                      <td className="px-4 py-3">{row.isReserve ? <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-800">Reserve</span> : <span className="text-gray-600">Main</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${row.studentGender === 'F' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {row.studentGender}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{row.rollNumber}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 truncate">{row.studentName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {entriesData.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex justify-between items-center text-xs bg-gray-50">
              <button
                disabled={entriesData.page <= 1}
                onClick={() => loadEntries(entriesData.page - 1, appliedFilters)}
                className="px-4 py-2 rounded-lg font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &larr; Previous
              </button>
              <span className="font-medium text-gray-600">Page {entriesData.page} of {entriesData.totalPages}</span>
              <button
                disabled={entriesData.page >= entriesData.totalPages}
                onClick={() => loadEntries(entriesData.page + 1, appliedFilters)}
                className="px-4 py-2 rounded-lg font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
        )}

        {/* IIITs & Payments Tab */}
        {activeTab === "payments" && (
          <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-bold text-xs text-gray-600">
                {registrationsOverview.length} IIIT accounts · {registrationsOverview.filter(r => r.isSubmitted).length} rosters locked
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="payment-filter" className="text-xs font-bold text-gray-600">Show</label>
                <select
                  id="payment-filter"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-[#1b5e20] focus:outline-none"
                >
                  <option value="all">All IIITs ({registrationsOverview.length})</option>
                  <option value="awaiting_verification">Awaiting verification ({stageCounts.awaiting_verification || 0})</option>
                  <option value="awaiting_payment">Awaiting payment ({stageCounts.awaiting_payment || 0})</option>
                  <option value="verified">Verified ({stageCounts.verified || 0})</option>
                  <option value="not_submitted">Not submitted ({stageCounts.not_submitted || 0})</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                    <th className="px-4 py-3">IIIT</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Students</th>
                    <th className="px-4 py-3 text-center">Amount</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-center">Payment</th>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Bank</th>
                    <th className="px-4 py-3 text-center">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRegistrations.map((row) => (
                    <tr key={row.iiitCode || row.iiitName} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-gray-900 truncate max-w-[180px]" title={row.iiitName}>{row.iiitName}</div>
                        {row.isSubmitted && (
                          <button type="button" onClick={() => viewIiitEntries(row)} className="mt-1 text-[11px] font-bold text-[#1b5e20] underline underline-offset-2 hover:text-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
                            View entries<span className="sr-only"> for {row.iiitName}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {row.contactName ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-gray-900">{row.contactName}</div>
                            {row.contactEmail && <a href={`mailto:${row.contactEmail}`} className="block text-[#1b5e20] underline underline-offset-2">{row.contactEmail}</a>}
                            {row.contactPhone && <a href={`tel:${row.contactPhone.replace(/[^+0-9]/g, "")}`} className="block text-gray-700 underline underline-offset-2">{row.contactPhone}</a>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status
                          ? <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-black">Roster locked</span>
                          : <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">Not submitted</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{row.isSubmitted ? row.totalStudentsCount : "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">
                        {row.paymentAmount
                          ? `₹${Number(row.paymentAmount).toLocaleString("en-IN")}`
                          : row.status === "payment_pending"
                          ? `₹${getRegistrationFee(row.totalStudentsCount).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {row.paymentMode === "OTHER" ? row.otherPaymentMode : (row.paymentMode || "—")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status === "submitted"
                          ? <div className="flex flex-col items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-black ${row.paymentVerificationStatus === "verified" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                {row.paymentVerificationStatus === "verified" ? "Bank Verified" : "Proof Submitted"}
                              </span>
                              {row.paymentVerificationStatus !== "verified" && row.paymentProofPathname && (
                                <button type="button" onClick={() => openVerification(row)} className="rounded-lg border border-[#1b5e20] px-2.5 py-1 text-[10px] font-bold text-[#1b5e20] hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700">
                                  Verify payment
                                </button>
                              )}
                            </div>
                          : row.status === "payment_pending"
                          ? <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">Awaiting Proof</span>
                          : <span className="text-gray-400 text-[10px]">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600 truncate max-w-[140px]">{row.paymentTransactionId || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.paymentTransactionDate
                          ? new Date(row.paymentTransactionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]">{row.paymentBankName || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {row.paymentProofPathname ? (
                          <a
                            href={`/api/payment/proof?iiitCode=${row.iiitCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold hover:bg-amber-200 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View<span className="sr-only"> payment proof for {row.iiitName}</span>
                          </a>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRegistrations.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-gray-600">No IIITs match this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "admins" && (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs" aria-labelledby="admin-accounts-title">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 id="admin-accounts-title" className="text-lg font-black text-gray-900">Admin accounts</h2>
              <p className="mt-1 text-sm text-gray-600">These accounts can view private proofs and verify bank payments. Accounts are added manually by an organizer.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                  <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Username</th><th className="px-5 py-3">Added</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="px-5 py-3 font-bold text-gray-900">{account.displayName || "—"}</td>
                      <td className="px-5 py-3 text-gray-700">{account.email || "Legacy account — no email"}</td>
                      <td className="px-5 py-3 font-mono text-gray-700">{account.username}</td>
                      <td className="px-5 py-3 text-gray-600">{new Date(account.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {verificationTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2112]/70 p-4" onClick={(event) => { if (event.target === event.currentTarget) closeVerification(); }}>
            <form ref={verificationPanelRef} onSubmit={submitVerification} role="dialog" aria-modal="true" aria-labelledby="verify-payment-title" tabIndex={-1} className="w-full max-w-lg rounded-2xl bg-[#faf6ee] p-6 shadow-2xl outline-none">
              <h2 id="verify-payment-title" className="text-xl font-black text-[#0a2112]">Verify bank transfer</h2>
              <p className="mt-2 text-sm text-gray-700">{verificationTarget.iiitName} submitted a proof for ₹{Number(verificationTarget.paymentAmount).toLocaleString("en-IN")}. Check the bank statement before confirming receipt.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="verify-utr" className="block text-xs font-bold uppercase tracking-wide text-gray-700">UTR shown on bank statement</label>
                  <input id="verify-utr" value={verificationUtr} onChange={(event) => setVerificationUtr(event.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-green-700 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="verify-amount" className="block text-xs font-bold uppercase tracking-wide text-gray-700">Amount received (₹)</label>
                  <input id="verify-amount" type="number" min="1" step="1" value={verificationAmount} onChange={(event) => setVerificationAmount(event.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none" />
                </div>
                <label className="flex items-start gap-3 text-sm font-medium text-gray-800">
                  <input type="checkbox" checked={bankConfirmed} onChange={(event) => setBankConfirmed(event.target.checked)} required className="mt-1 size-4 accent-[#1b5e20]" />
                  I matched the UTR and amount to an actual credit in the organizer&apos;s bank account.
                </label>
              </div>
              {verificationError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{verificationError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeVerification} disabled={verificationBusy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={verificationBusy || !bankConfirmed} className="rounded-lg bg-[#1b5e20] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{verificationBusy ? "Verifying…" : "Mark verified"}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
