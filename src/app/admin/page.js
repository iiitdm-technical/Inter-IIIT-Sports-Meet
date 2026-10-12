"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAllSportsList } from "@/lib/sports/config";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState("entries");
  const [registrationsOverview, setRegistrationsOverview] = useState([]);

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
  const [entriesLoading, setEntriesLoading] = useState(false);
  const entriesRequest = useRef(0);

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


  const loadEntries = useCallback(async (page = 1, searchFilters = filters) => {
    const requestId = ++entriesRequest.current;
    setEntriesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "25");
      for (const [key, value] of Object.entries(searchFilters)) {
        if (value) params.set(key, value);
      }

      const res = await fetch(`/api/admin/entries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (requestId === entriesRequest.current) setEntriesData(data.data);
      }
    } catch (err) {
      console.error("Failed to filter entries:", err);
    } finally {
      if (requestId === entriesRequest.current) setEntriesLoading(false);
    }
  }, [filters]);

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

        // Fetch overview stats and initial entries
        const statsRes = await fetch("/api/admin/stats");
        if (statsRes.ok) {
          const sData = await statsRes.json();
          setStats(sData.data || null);
        }

        // Fetch registrations overview (for IIITs & Payments tab)
        const regRes = await fetch("/api/admin/registrations");
        if (regRes.ok) {
          const regData = await regRes.json();
          setRegistrationsOverview(regData.data || []);
        }

      } catch (err) {
        console.error("Failed to load admin data:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadData();
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => loadEntries(1), 300);
    return () => clearTimeout(timer);
  }, [currentUser, loadEntries]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadEntries(1);
  };

  const downloadMasterCsv = (useFilters = false) => {
    const params = new URLSearchParams();
    if (useFilters) {
      if (filters.iiit) params.set("iiit", filters.iiit);
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.event) params.set("event", filters.event);
      if (filters.gender) params.set("gender", filters.gender);
      if (filters.rollNumber) params.set("rollNumber", filters.rollNumber);
      if (filters.name) params.set("name", filters.name);
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
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider" style={{ background: "#f5c518", color: "#0a2112" }}>
              Admin
            </span>
            <h1 className="text-white text-base font-black tracking-wide">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-300">
              Logged in as <strong className="text-white">{currentUser?.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? "Logging out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Submitted IIITs</div>
              <div className="text-3xl font-black mt-2" style={{ color: "#1b5e20" }}>
                {stats.submittedIIITs} / {stats.totalIIITs}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Unique Students</div>
              <div className="text-3xl font-black mt-2" style={{ color: "#0a2112" }}>
                {stats.totalStudents}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Event Entries</div>
              <div className="text-3xl font-black mt-2" style={{ color: "#c9972f" }}>
                {stats.totalEventEntries}
              </div>
            </div>
          </div>
        )}

        {/* Tab Nav */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "entries"
                ? "border-[#1b5e20] text-[#1b5e20]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Registration Entries
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "payments"
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            IIITs &amp; Payments
          </button>
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">IIIT</label>
                <input
                  type="text"
                  value={filters.iiit}
                  onChange={(e) => setFilters({ ...filters, iiit: e.target.value })}
                  placeholder="e.g. Gwalior"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Sport</label>
                <select
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Event</label>
                <select
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Gender</label>
                <select
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Roll Number</label>
                <input
                  type="text"
                  value={filters.rollNumber}
                  onChange={(e) => setFilters({ ...filters, rollNumber: e.target.value })}
                  placeholder="e.g. 22CS101"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 outline-none focus:border-[#1b5e20]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Student Name</label>
                <input
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
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center text-xs text-gray-600">
            <span className="font-bold">Matching Entries: {entriesData.total || 0}</span>
            {entriesData.totalPages > 0 && (
              <span>Page {entriesData.page} of {entriesData.totalPages}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">IIIT Name</th>
                  <th className="px-4 py-3">Sport</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-center">Gender</th>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3 w-full">Student Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!entriesData.rows || entriesData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      {entriesLoading ? "Searching database..." : (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p>No submitted entries found matching your criteria.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  entriesData.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 truncate max-w-[200px]" title={row.iiitName}>{row.iiitName}</td>
                      <td className="px-4 py-3 font-medium capitalize text-gray-800">{row.sportId}</td>
                      <td className="px-4 py-3 text-gray-800">{row.eventId}</td>
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
                onClick={() => loadEntries(entriesData.page - 1)}
                className="px-4 py-2 rounded-lg font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &larr; Previous
              </button>
              <span className="font-medium text-gray-600">Page {entriesData.page} of {entriesData.totalPages}</span>
              <button
                disabled={entriesData.page >= entriesData.totalPages}
                onClick={() => loadEntries(entriesData.page + 1)}
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
            <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <span className="font-bold text-xs text-gray-600">{registrationsOverview.length} IIITs registered</span>
              <span className="text-xs text-gray-400">{registrationsOverview.filter(r => r.isSubmitted).length} submitted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">IIIT</th>
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
                  {registrationsOverview.map((row) => (
                    <tr key={row.iiitCode || row.iiitName} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 truncate max-w-[180px]" title={row.iiitName}>{row.iiitName}</td>
                      <td className="px-4 py-3 text-center">
                        {row.status === "submitted"
                          ? <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-black">Submitted</span>
                          : row.status === "payment_pending"
                          ? <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">Payment Pending</span>
                          : <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">Draft</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{row.isSubmitted ? row.totalStudentsCount : "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">
                        {row.paymentAmount
                          ? `₹${Number(row.paymentAmount).toLocaleString("en-IN")}`
                          : row.status === "payment_pending"
                          ? `₹${(row.totalStudentsCount * 2500).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {row.paymentMode === "OTHER" ? row.otherPaymentMode : (row.paymentMode || "—")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status === "submitted"
                          ? <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-black">Proof Submitted</span>
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
                            View
                          </a>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {registrationsOverview.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-gray-400">No IIITs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
