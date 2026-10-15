"use client";

export default function ContactForm({ contactDetails, onChange }) {
  const handleChange = (field, value) => {
    onChange({
      ...contactDetails,
      [field]: value,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
      <div className="bg-[#0a2112] px-6 py-4">
        <h2 className="font-black text-white text-lg tracking-wide uppercase">Contingent Contact Details</h2>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="contact-name" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Faculty In-Charge / Contact Name *</label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            required
            value={contactDetails.contactName}
            onChange={(e) => handleChange("contactName", e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            placeholder="E.g., Dr. Rajesh Kumar"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Official Email *</label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            required
            value={contactDetails.contactEmail}
            onChange={(e) => handleChange("contactEmail", e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            placeholder="sports@iiit.ac.in"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Contact Phone *</label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            required
            value={contactDetails.contactPhone}
            onChange={(e) => handleChange("contactPhone", e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            placeholder="+91 9876543210"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="contact-notes" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Special Arrival Notes (Optional)</label>
          <textarea
            id="contact-notes"
            value={contactDetails.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-700 focus:bg-white transition-colors min-h-[80px]"
            placeholder="E.g., Contingent arrives on 18th Dec morning via train..."
          />
        </div>
      </div>
    </div>
  );
}
