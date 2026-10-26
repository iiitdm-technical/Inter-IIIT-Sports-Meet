"use client";

import { TRAVEL_MODES, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX, DEPARTURE_DATE_MIN, DEPARTURE_DATE_MAX } from "@/lib/registration/arrival";
import { STAFF_MIN, STAFF_MAX } from "@/lib/registration/contingent";

const fieldClass = "w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";
const required = <span className="text-red-700" aria-hidden="true">*</span>;
const optional = <span className="font-normal text-ink-muted">(optional)</span>;

export default function ContactForm({ contactDetails, onChange, studentCounts = { boys: 0, girls: 0 } }) {
  const handleChange = (field, value) => {
    onChange({
      ...contactDetails,
      [field]: value,
    });
  };

  return (
    <section className="card card-accent mb-8 p-5 sm:p-6" aria-labelledby="contact-details-title">
      <div className="mb-5">
        <h3 id="contact-details-title" className="heading-card text-lg">Contingent contact details</h3>
        <p className="meta mt-1">The organizers use these to reach your institute about the roster and payment.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClass}>Faculty in-charge / contact name <span className="text-red-700" aria-hidden="true">*</span></label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            required
            value={contactDetails.contactName}
            onChange={(e) => handleChange("contactName", e.target.value)}
            className={fieldClass}
            placeholder="E.g., Dr. Rajesh Kumar"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>Official email <span className="text-red-700" aria-hidden="true">*</span></label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            required
            value={contactDetails.contactEmail}
            onChange={(e) => handleChange("contactEmail", e.target.value)}
            className={fieldClass}
            placeholder="sports@iiit.ac.in"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className={labelClass}>Contact phone <span className="text-red-700" aria-hidden="true">*</span></label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            required
            value={contactDetails.contactPhone}
            onChange={(e) => handleChange("contactPhone", e.target.value)}
            className={fieldClass}
            placeholder="+91 9876543210"
          />
        </div>
      </div>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="heading-card float-left mb-1 w-full text-base">Travel details</legend>
        <p className="meta clear-left mb-4">So the organizers can plan pickups and accommodation. The meet runs 19 to 23 December 2026.</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label htmlFor="contact-arrival-date" className={labelClass}>Arrival date {required}</label>
            <input
              id="contact-arrival-date"
              type="date"
              required
              min={ARRIVAL_DATE_MIN}
              max={ARRIVAL_DATE_MAX}
              value={contactDetails.arrivalDate || ""}
              onChange={(e) => handleChange("arrivalDate", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="contact-arrival-time" className={labelClass}>Arrival time {required}</label>
            <input
              id="contact-arrival-time"
              type="time"
              required
              value={contactDetails.arrivalTime || ""}
              onChange={(e) => handleChange("arrivalTime", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="contact-travel-mode" className={labelClass}>Mode of travel {required}</label>
            <select
              id="contact-travel-mode"
              required
              value={contactDetails.travelMode || ""}
              onChange={(e) => handleChange("travelMode", e.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>Select mode</option>
              {TRAVEL_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 md:col-span-2">
            <label htmlFor="contact-arrival-point" className={labelClass}>Arriving at {optional}</label>
            <input
              id="contact-arrival-point"
              type="text"
              maxLength={128}
              value={contactDetails.arrivalPoint || ""}
              onChange={(e) => handleChange("arrivalPoint", e.target.value)}
              className={fieldClass}
              placeholder="E.g., Chennai Central, Chennai Airport, Tambaram"
            />
          </div>
          <div>
            <label htmlFor="contact-departure-date" className={labelClass}>Exit date {required}</label>
            <input
              id="contact-departure-date"
              type="date"
              required
              min={contactDetails.arrivalDate > DEPARTURE_DATE_MIN ? contactDetails.arrivalDate : DEPARTURE_DATE_MIN}
              max={DEPARTURE_DATE_MAX}
              value={contactDetails.departureDate || ""}
              onChange={(e) => handleChange("departureDate", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <label htmlFor="contact-notes" className={labelClass}>
              Other notes {contactDetails.travelMode === "Other" ? required : optional}
            </label>
            <textarea
              id="contact-notes"
              required={contactDetails.travelMode === "Other"}
              maxLength={1000}
              value={contactDetails.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              className={`${fieldClass} min-h-[84px]`}
              placeholder={contactDetails.travelMode === "Other"
                ? "Describe how the contingent is travelling."
                : "E.g., Train number, number of people arriving, anything the organizers should know."}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="heading-card float-left mb-1 w-full text-base">Sports secretaries</legend>
        <p className="meta clear-left mb-4">Your institute&apos;s student sports secretaries, for coordination during the meet.</p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-control border border-line bg-white/60 p-4">
            <p className="mb-3 text-sm font-bold text-ink">Boys&apos; sports secretary</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="contact-boys-secretary-name" className={labelClass}>Name {required}</label>
                <input
                  id="contact-boys-secretary-name"
                  type="text"
                  required
                  maxLength={128}
                  value={contactDetails.boysSecretaryName || ""}
                  onChange={(e) => handleChange("boysSecretaryName", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="contact-boys-secretary-phone" className={labelClass}>Phone number {required}</label>
                <input
                  id="contact-boys-secretary-phone"
                  type="tel"
                  required
                  maxLength={32}
                  value={contactDetails.boysSecretaryPhone || ""}
                  onChange={(e) => handleChange("boysSecretaryPhone", e.target.value)}
                  className={fieldClass}
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label htmlFor="contact-boys-secretary-email" className={labelClass}>Institute email {required}</label>
                <input
                  id="contact-boys-secretary-email"
                  type="email"
                  required
                  maxLength={128}
                  value={contactDetails.boysSecretaryEmail || ""}
                  onChange={(e) => handleChange("boysSecretaryEmail", e.target.value)}
                  className={fieldClass}
                  placeholder="name@iiit.ac.in"
                />
              </div>
            </div>
          </div>
          <div className="rounded-control border border-line bg-white/60 p-4">
            <p className="mb-3 text-sm font-bold text-ink">Girls&apos; sports secretary</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="contact-girls-secretary-name" className={labelClass}>Name {required}</label>
                <input
                  id="contact-girls-secretary-name"
                  type="text"
                  required
                  maxLength={128}
                  value={contactDetails.girlsSecretaryName || ""}
                  onChange={(e) => handleChange("girlsSecretaryName", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="contact-girls-secretary-phone" className={labelClass}>Phone number {required}</label>
                <input
                  id="contact-girls-secretary-phone"
                  type="tel"
                  required
                  maxLength={32}
                  value={contactDetails.girlsSecretaryPhone || ""}
                  onChange={(e) => handleChange("girlsSecretaryPhone", e.target.value)}
                  className={fieldClass}
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label htmlFor="contact-girls-secretary-email" className={labelClass}>Institute email {required}</label>
                <input
                  id="contact-girls-secretary-email"
                  type="email"
                  required
                  maxLength={128}
                  value={contactDetails.girlsSecretaryEmail || ""}
                  onChange={(e) => handleChange("girlsSecretaryEmail", e.target.value)}
                  className={fieldClass}
                  placeholder="name@iiit.ac.in"
                />
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="heading-card float-left mb-1 w-full text-base">Contingent strength</legend>
        <p className="meta clear-left mb-4">Boys and girls are counted from the students entered below; a student in several events counts once.</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <p id="contact-boys-count-label" className={labelClass}>No. of boys {required}</p>
            <output aria-labelledby="contact-boys-count-label" className="flex h-[46px] items-center rounded-control border border-line bg-ivory px-3.5 font-semibold text-ink">{studentCounts.boys}</output>
          </div>
          <div>
            <p id="contact-girls-count-label" className={labelClass}>No. of girls {required}</p>
            <output aria-labelledby="contact-girls-count-label" className="flex h-[46px] items-center rounded-control border border-line bg-ivory px-3.5 font-semibold text-ink">{studentCounts.girls}</output>
          </div>
          <div>
            <label htmlFor="contact-staff-count" className={labelClass}>No. of accompanying staff {required}</label>
            <input
              id="contact-staff-count"
              type="number"
              inputMode="numeric"
              required
              min={STAFF_MIN}
              max={STAFF_MAX}
              step={1}
              value={contactDetails.staffCount ?? ""}
              onChange={(e) => handleChange("staffCount", e.target.value)}
              className={fieldClass}
              aria-describedby="contact-staff-count-help"
            />
            <p id="contact-staff-count-help" className="meta mt-1.5">{STAFF_MIN} to {STAFF_MAX}: up to 2 officials and 1 supporting staff, including a permanent staff member.</p>
          </div>
        </div>
      </fieldset>
    </section>
  );
}
