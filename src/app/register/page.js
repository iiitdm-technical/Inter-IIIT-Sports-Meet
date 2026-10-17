"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import RegistrationHeader from "@/components/registration/RegistrationHeader";
import ContactForm from "@/components/registration/ContactForm";
import SportSection from "@/components/registration/SportSection";
import ReviewModal from "@/components/registration/ReviewModal";
import LockedRegistration from "@/components/registration/LockedRegistration";
import PaymentPending from "@/components/registration/PaymentPending";
import { getAllSportsList } from "@/lib/sports/config";
import { getLiveValidationErrors, getStudentRegistry, getSlotInputId, parseSlotKey } from "@/lib/registration/client-utils";

export default function RegisterPage() {
  const router = useRouter();
  
  // Auth & API state
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [lockedRegistrationData, setLockedRegistrationData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  
  // Form State
  const [contactDetails, setContactDetails] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: ""
  });
  const [slotsMap, setSlotsMap] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [conflictDraft, setConflictDraft] = useState(null);
  const [saveRetryCount, setSaveRetryCount] = useState(0);
  const draftRevisionRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const conflictRef = useRef(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState("M");
  const [openSections, setOpenSections] = useState(() => new Set());
  const [focusRequest, setFocusRequest] = useState(0);
  const pendingFocusRef = useRef(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize and check auth/registration status
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          throw new Error("Could not verify your session. Please try again.");
        }
        const authData = await authRes.json();
        if (!authData || !authData.user) {
          router.push("/login");
          return;
        }
        if (authData.user.role === "admin") {
          router.push("/admin");
          return;
        }
        setUser(authData.user);

        const regRes = await fetch("/api/registration");
        if (!regRes.ok) {
          throw new Error("Could not load your registration. Please try again before editing.");
        }
        const regData = await regRes.json();
        if (!regData?.data || typeof regData.data.submitted !== "boolean") {
          throw new Error("Registration response was incomplete. Please try again.");
        }
        if (regData.data?.submitted) {
          setLockedRegistrationData(regData.data);
          setLoading(false);
          return;
        }
        
        // Not submitted → load the cloud draft, preserving newer local edits.
        const draftRes = await fetch("/api/registration/draft");
        if (!draftRes.ok) {
          throw new Error("Could not load your saved draft. Please try again before editing.");
        }
        const cloudDraft = (await draftRes.json()).data;
        draftRevisionRef.current = cloudDraft?.revision || 0;
        const draftKey = `inter_iiit_registration_${authData.user.username}`;
        let localDraft = null;
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) localDraft = JSON.parse(saved);
        } catch {
          setSaveError("This browser cannot access your local draft. Changes may not be saved.");
        }
        const localIsNewer = localDraft?.updatedAt &&
          (!cloudDraft || Date.parse(localDraft.updatedAt) > Date.parse(cloudDraft.updatedAt));
        const draft = localIsNewer ? localDraft : cloudDraft || localDraft;
        if (draft?.contactDetails) setContactDetails(draft.contactDetails);
        if (draft?.slotsMap) setSlotsMap(draft.slotsMap);
        if (cloudDraft && !localIsNewer) setLastSaved(new Date(cloudDraft.updatedAt));
        setLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        setLoadError(err.message || "Could not load your registration. Please try again.");
        setLoading(false);
      }
    };
    init();
  }, [router, retryCount]);

  // Save immediately in this browser, then sync each change to Neon in order.
  useEffect(() => {
    if (loading || loadError || lockedRegistrationData || !user) return;
    
    const draftKey = `inter_iiit_registration_${user.username}`;
    const snapshot = { contactDetails, slotsMap, updatedAt: new Date().toISOString() };
    const localTimer = setTimeout(() => {
      setLastSaved(null);
      try {
        localStorage.setItem(draftKey, JSON.stringify(snapshot));
      } catch {
        setSaveError("This browser cannot save a local copy. Keep this page open until cloud save succeeds.");
      }
    }, 0);
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (conflictRef.current) return;
        try {
          const response = await fetch("/api/registration/draft", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revision: draftRevisionRef.current, contactDetails, slotsMap }),
          });
          const result = await response.json().catch(() => null);
          if (response.status === 409 && result?.data) {
            conflictRef.current = true;
            setConflictDraft(result.data);
            setSaveError("A newer draft was saved in another session. Choose which version to keep below.");
            return;
          }
          if (!response.ok) throw new Error(result?.error || "Cloud save failed");
          draftRevisionRef.current = result.data.revision;
          setLastSaved(new Date(result.data.updatedAt));
          setSaveError("");
        } catch {
          setSaveError("Cloud save failed. Your draft remains in this browser; retry when connected.");
        }
      });
    }, 1000);
    
    return () => {
      clearTimeout(localTimer);
      clearTimeout(timer);
    };
  }, [contactDetails, slotsMap, loading, loadError, lockedRegistrationData, user, saveRetryCount]);

  const handleLoadCloudDraft = () => {
    if (!conflictDraft) return;
    draftRevisionRef.current = conflictDraft.revision;
    setContactDetails(conflictDraft.contactDetails);
    setSlotsMap(conflictDraft.slotsMap);
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveError("");
  };

  const handleKeepLocalDraft = () => {
    if (!conflictDraft) return;
    draftRevisionRef.current = conflictDraft.revision;
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveError("");
    setSaveRetryCount((count) => count + 1);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    // Do NOT clear localStorage — draft must survive logout/login cycle
    router.push("/login");
  };

  const handleSlotChange = useCallback((key, newSlotData) => {
    setSlotsMap(prev => ({
      ...prev,
      [key]: newSlotData
    }));
  }, []);

  const toggleSection = useCallback((sectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  // Close the review, reveal the slot or contact field an issue refers to, and focus it.
  const handleGoToIssue = useCallback((issue) => {
    setIsReviewOpen(false);
    setSubmitError("");
    if (issue.fieldId) {
      pendingFocusRef.current = issue.fieldId;
    } else if (issue.slotKeys.length > 0) {
      const key = issue.slotKeys[0];
      const slot = parseSlotKey(key);
      if (!slot) return;
      setActiveTab(slot.eventGender);
      setOpenSections((prev) => new Set(prev).add(`${slot.sportId}|${slot.eventGender}`));
      pendingFocusRef.current = getSlotInputId(key);
    } else {
      return;
    }
    setFocusRequest((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!focusRequest || !pendingFocusRef.current) return;
    // Wait for the tab, section and dialog changes to render before focusing.
    const timer = setTimeout(() => {
      const element = document.getElementById(pendingFocusRef.current);
      pendingFocusRef.current = null;
      if (!element) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      element.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    
    try {
      const { payload, isValid, errors } = getLiveValidationErrors(contactDetails, slotsMap);
      
      if (!isValid) {
        setSubmitError("Please fix validation errors before submitting.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        throw new Error((data && data.error) ? data.error : `Submission failed with status ${res.status}`);
      }
      
      // Success — clear local draft and reload to show locked state
      try {
        localStorage.removeItem(`inter_iiit_registration_${user.username}`);
      } catch {
        // The server has accepted and locked the registration; reload its authoritative state.
      }
      window.location.reload();
      
    } catch (err) {
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6ee] flex flex-col items-center justify-center gap-3" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800" aria-hidden="true"></div>
        <p className="text-sm font-bold text-[#0a2112]">Loading your registration…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#faf6ee] px-4 py-16 flex items-start justify-center">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-black text-[#0a2112]">Registration unavailable</h1>
          <p className="mt-3 text-sm text-gray-700">{loadError}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-6 rounded-lg bg-[#1b5e20] px-5 py-3 text-sm font-bold text-white hover:bg-green-800">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // If locked, show the readonly locked view
  if (lockedRegistrationData) {
    if (lockedRegistrationData.registration.status === 'payment_pending') {
      return <PaymentPending iiitCode={user.username} registrationData={lockedRegistrationData} />;
    }
    return <LockedRegistration registrationData={lockedRegistrationData} />;
  }

  // Compute live validation state for the form UI
  let isValid = false;
  let errors = [];
  let issues = [];
  let totalUniqueStudents = 0;
  let payload = null;
  try {
    const result = getLiveValidationErrors(contactDetails, slotsMap);
    isValid = result.isValid;
    errors = result.errors;
    issues = result.issues;
    totalUniqueStudents = result.totalUniqueStudents;
    payload = result.payload;
  } catch (e) {
    console.error("Render-time validation error:", e);
    errors = ["Internal validation error — please refresh the page."];
    issues = [{ message: errors[0], slotKeys: [], fieldId: null }];
  }
  const errorSlotKeys = new Set(issues.flatMap((issue) => issue.slotKeys));
  const firstIssue = issues[0];
  const canShowFirstIssue = firstIssue && (firstIssue.slotKeys.length > 0 || firstIssue.fieldId);

  const studentRegistry = getStudentRegistry(slotsMap);

  return (
    <div className="min-h-screen bg-[#faf6ee] font-sans pb-48 sm:pb-32">
      <RegistrationHeader 
        iiitName={user.iiitName || user.username} 
        uniqueStudentsCount={totalUniqueStudents} 
        lastSaved={lastSaved}
        saveFailed={Boolean(saveError)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {saveError && (
        <div role="alert" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            <p>{saveError}</p>
            {conflictDraft ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={handleLoadCloudDraft} className="rounded-lg border border-amber-700 px-3 py-2">Load cloud version</button>
                <button type="button" onClick={handleKeepLocalDraft} className="rounded-lg bg-[#1b5e20] px-3 py-2 text-white">Keep this version</button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaveRetryCount((count) => count + 1)} className="mt-2 underline underline-offset-2">Retry cloud save</button>
            )}
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <ContactForm 
          contactDetails={contactDetails} 
          onChange={setContactDetails} 
        />
        
        {/* Navigation Tabs for Gender Sections */}
        <div role="tablist" aria-label="Event categories" className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6 grid grid-cols-1 sm:flex sm:flex-nowrap gap-2">
          {[["M", "Men's Events"], ["F", "Women's Events"], ["mixed", "Combined Events"]].map(([tab, tabLabel]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`category-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls="category-panel"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${activeTab === tab ? "bg-[#1b5e20] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              {tabLabel}
            </button>
          ))}
        </div>
        
        {/* Render sports for the active tab */}
        <div id="category-panel" role="tabpanel" aria-labelledby={`category-tab-${activeTab}`} className="space-y-4">
          {getAllSportsList().map(sport => (
            <SportSection
              key={sport.id}
              sportConfig={sport}
              gender={activeTab}
              slotsMap={slotsMap}
              onChangeSlot={handleSlotChange}
              studentRegistry={studentRegistry}
              isOpen={openSections.has(`${sport.id}|${activeTab}`)}
              onToggle={() => toggleSection(`${sport.id}|${activeTab}`)}
              errorSlotKeys={errorSlotKeys}
            />
          ))}
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {submitError && (
              <div className="text-red-700 text-sm font-bold bg-red-50 px-3 py-1.5 rounded flex items-center gap-1.5 break-words">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                {submitError}
              </div>
            )}
            {!isValid && !submitError && (
              <div className="text-red-700 text-sm bg-red-50 border border-red-200 px-3 py-1.5 rounded flex items-center gap-1.5 w-full min-w-0">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                <span className="min-w-0 flex-1"><span className="font-black">{errors.length} issue{errors.length !== 1 ? 's' : ''}</span><span className="hidden sm:inline"> — <span className="font-medium break-words">{errors[0]}</span>{errors.length > 1 && <span className="font-bold"> (+{errors.length - 1} more in Review)</span>}</span></span>
                {canShowFirstIssue && (
                  <button
                    type="button"
                    onClick={() => handleGoToIssue(firstIssue)}
                    className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    Show<span className="sr-only"> first issue</span>
                  </button>
                )}
              </div>
            )}
            {isValid && !submitError && (
              <div className="text-green-700 text-sm font-bold bg-green-50 px-3 py-1.5 rounded inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                All validation rules passed
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#f5c518] text-[#0a2112] font-black rounded-xl shadow hover:-translate-y-0.5 transition-all text-sm uppercase tracking-wide"
            >
              Review &amp; Submit
            </button>
          </div>
        </div>
      </div>

      {isReviewOpen && (
        <ReviewModal
          onClose={() => { setIsReviewOpen(false); setSubmitError(""); }}
          onSubmit={handleFinalSubmit}
          isSubmitting={isSubmitting}
          payload={payload}
          issues={issues}
          submitError={submitError}
          uniqueStudentsCount={totalUniqueStudents}
          onGoToIssue={handleGoToIssue}
        />
      )}
    </div>
  );
}
