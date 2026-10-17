"use client";

const fieldClass = "w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

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
        <div className="md:col-span-2">
          <label htmlFor="contact-notes" className={labelClass}>Arrival notes <span className="font-normal text-ink-muted">(optional)</span></label>
          <textarea
            id="contact-notes"
            value={contactDetails.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            className={`${fieldClass} min-h-[84px]`}
            placeholder="E.g., Contingent arrives on 18th Dec morning via train..."
          />
        </div>
      </div>
    </section>
  );
}
