"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import RegistrationHeader from "@/components/registration/RegistrationHeader";
import ContactForm from "@/components/registration/ContactForm";
import SportSection from "@/components/registration/SportSection";
import ReviewModal from "@/components/registration/ReviewModal";
import LockedRegistration from "@/components/registration/LockedRegistration";
import PaymentPending from "@/components/registration/PaymentPending";
import { getAllSportsList } from "@/lib/sports/config";
import { getLiveValidationErrors, getStudentRegistry } from "@/lib/registration/client-utils";

export default function RegisterPage() {
  const router = useRouter();
  
  // Auth & API state
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [lockedRegistrationData, setLockedRegistrationData] = useState(null);
  
  // Form State
  const [contactDetails, setContactDetails] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: ""
  });
  const [slotsMap, setSlotsMap] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState("M");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize and check auth/registration status
  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          router.push("/login");
          return;
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
        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.data && regData.data.submitted) {
            setLockedRegistrationData(regData.data);
            setLoading(false);
            return;
          }
        }
        
        // Not submitted → load draft from localStorage
        const draftKey = `inter_iiit_registration_${authData.user.username}`;
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.contactDetails) setContactDetails(parsed.contactDetails);
            if (parsed.slotsMap) setSlotsMap(parsed.slotsMap);
          } catch (e) {
            console.error("Failed to parse local draft", e);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        router.push("/login");
      }
    };
    init();
  }, [router]);

  // Auto-save to localStorage
  useEffect(() => {
    if (loading || lockedRegistrationData || !user) return;
    
    const draftKey = `inter_iiit_registration_${user.username}`;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ contactDetails, slotsMap }));
      setLastSaved(new Date());
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [contactDetails, slotsMap, loading, lockedRegistrationData, user]);

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
      localStorage.removeItem(`inter_iiit_registration_${user.username}`);
      window.location.reload();
      
    } catch (err) {
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6ee] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800"></div>
      </div>
    );
  }

  // If locked, show the readonly locked view
  if (lockedRegistrationData) {
    if (lockedRegistrationData.registration.status === 'payment_pending') {
      return <PaymentPending iiitCode={user.username} registrationData={lockedRegistrationData} />;
    }
    return <LockedRegistration iiitCode={user.username} registrationData={lockedRegistrationData} />;
  }

  // Compute live validation state for the form UI
  let isValid = false;
  let errors = [];
  let totalUniqueStudents = 0;
  let payload = null;
  try {
    const result = getLiveValidationErrors(contactDetails, slotsMap);
    isValid = result.isValid;
    errors = result.errors;
    totalUniqueStudents = result.totalUniqueStudents;
    payload = result.payload;
  } catch (e) {
    console.error("Render-time validation error:", e);
    errors = ["Internal validation error — please refresh the page."];
  }

  const studentRegistry = getStudentRegistry(slotsMap);

  return (
    <div className="min-h-screen bg-[#faf6ee] font-sans pb-48 sm:pb-32">
      <RegistrationHeader 
        iiitName={user.iiitName || user.username} 
        uniqueStudentsCount={totalUniqueStudents} 
        lastSaved={lastSaved}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <ContactForm 
          contactDetails={contactDetails} 
          onChange={setContactDetails} 
        />
        
        {/* Navigation Tabs for Gender Sections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6 grid grid-cols-1 sm:flex sm:flex-nowrap gap-2">
          <button 
            onClick={() => setActiveTab("M")}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-colors ${activeTab === "M" ? "bg-[#1b5e20] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
          >
            Men&apos;s Events
          </button>
          <button 
            onClick={() => setActiveTab("F")}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-colors ${activeTab === "F" ? "bg-[#1b5e20] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
          >
            Women&apos;s Events
          </button>
          <button 
            onClick={() => setActiveTab("mixed")}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-colors ${activeTab === "mixed" ? "bg-[#1b5e20] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
          >
            Combined Events
          </button>
        </div>
        
        {/* Render sports for the active tab */}
        <div className="space-y-4">
          {getAllSportsList().map(sport => (
            <SportSection
              key={sport.id}
              sportConfig={sport}
              gender={activeTab}
              slotsMap={slotsMap}
              onChangeSlot={handleSlotChange}
              studentRegistry={studentRegistry}
            />
          ))}
        </div>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {submitError && (
              <div className="text-red-600 text-sm font-bold bg-red-50 px-3 py-1.5 rounded flex items-center gap-1.5 break-words">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                {submitError}
              </div>
            )}
            {!isValid && !submitError && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-1.5 rounded flex items-center gap-1.5 w-full min-w-0">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                <span className="min-w-0"><span className="font-black">{errors.length} issue{errors.length !== 1 ? 's' : ''}</span><span className="sm:hidden"> — open Review to fix</span><span className="hidden sm:inline"> — <span className="font-medium break-words">{errors[0]}</span>{errors.length > 1 ? <span className="font-bold"> (+{errors.length - 1} more — open Review)</span> : <span className="font-bold"> — open Review to fix</span>}</span></span>
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
              onClick={() => setIsReviewOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#f5c518] text-[#0a2112] font-black rounded-xl shadow hover:-translate-y-0.5 transition-all text-sm uppercase tracking-wide"
            >
              Review &amp; Submit
            </button>
          </div>
        </div>
      </div>

      <ReviewModal 
        isOpen={isReviewOpen}
        onClose={() => { setIsReviewOpen(false); setSubmitError(""); }}
        onSubmit={handleFinalSubmit}
        isSubmitting={isSubmitting}
        payload={payload}
        errors={errors}
        submitError={submitError}
        uniqueStudentsCount={totalUniqueStudents}
        iiitCode={user?.username}
      />
    </div>
  );
}
