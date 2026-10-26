"use client";

import { TRAVEL_MODES, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX, DEPARTURE_DATE_MIN, DEPARTURE_DATE_MAX } from "@/lib/registration/arrival";

const fieldClass = "w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";
const required = <span className="text-red-700" aria-hidden="true">*</span>;
const optional = <span className="font-normal text-ink-muted">(optional)</span>;

export default function ContactForm({ contactDetails, onChange }) {
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
            <label htmlFor="contact-departure-date" className={labelClass}>Departure date {optional}</label>
            <input
              id="contact-departure-date"
              type="date"
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
    </section>
  );
}
