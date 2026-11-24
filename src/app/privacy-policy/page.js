export const metadata = {
  title: "Privacy Policy | Inter-IIIT Live",
  description:
    "Privacy Policy for the Inter-IIIT Live mobile application (9th All India Inter-IIIT Sports Meet).",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-900">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Last updated: November 24, 2026
      </p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-neutral-800">
        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            1. Overview
          </h2>
          <p className="mt-2">
            This Privacy Policy describes how <strong>Inter-IIIT Live</strong>{" "}
            (package ID: <code>in.ac.iiitdm.interiiit</code>), developed for the
            9th All India Inter-IIIT Sports Meet, handles information when you
            use our mobile application.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            2. Information We Collect
          </h2>
          <p className="mt-2">
            Inter-IIIT Live is designed to provide live scores, match schedules,
            medal tallies, and event announcements. We do not sell your personal
            data. Depending on the features you use, the app may process:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Account &amp; Profile Information:</strong> If you sign in
              as a participant, coordinator, or official, we process your name,
              institute, or email address solely for authentication and event
              coordination.
            </li>
            <li>
              <strong>Camera &amp; Media:</strong> If you upload photos or scan
              QR codes within the app, camera or photo library access is used
              only at your explicit request.
            </li>
            <li>
              <strong>Device &amp; Diagnostic Data:</strong> Basic technical
              information (such as app version and crash logs) may be processed
              to maintain app stability and performance.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            3. How We Use Information
          </h2>
          <p className="mt-2">
            Information is used strictly to display live event data, authenticate
            authorized users, improve app reliability, and communicate official
            9th All India Inter-IIIT Sports Meet updates.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            4. Data Security &amp; Retention
          </h2>
          <p className="mt-2">
            All network communication between the app and our servers is
            encrypted in transit using HTTPS. We retain data only for as long as
            necessary to operate the Inter-IIIT Sports Meet services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            5. Third-Party Services
          </h2>
          <p className="mt-2">
            The app uses cloud infrastructure (such as Convex and Expo services)
            to deliver real-time updates and app functionality. These providers
            process data only as required to provide their services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-900">
            6. Your Rights &amp; Contact
          </h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy or wish to request
            deletion of any account data, please contact the organizing team via
            the official Inter-IIIT Sports Meet contact page.
          </p>
        </section>
      </div>
    </main>
  );
}
