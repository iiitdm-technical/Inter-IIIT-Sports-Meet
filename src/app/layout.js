import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://interiiitsportsmeet.vercel.app"),
  title: {
    default: "9th Inter-IIIT Sports Meet 2026 | IIITDM Kancheepuram",
    template: "%s | Inter-IIIT Sports Meet 2026",
  },
  description: "The 9th All India Inter-IIIT Sports Meet 2026, hosted by IIITDM Kancheepuram from 19–23 December 2026. Follow events, teams, registration, and venue updates.",
  keywords: [
    "Inter-IIIT Sports Meet 2026",
    "All India Inter-IIIT Sports Meet",
    "IIITDM Kancheepuram sports meet",
    "Inter IIIT registration",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Inter-IIIT Sports Meet 2026",
    title: "9th Inter-IIIT Sports Meet 2026 | IIITDM Kancheepuram",
    description: "The 9th All India Inter-IIIT Sports Meet, hosted by IIITDM Kancheepuram from 19–23 December 2026.",
    images: [{ url: "/assets/brand/inter-iiit-logo.png", alt: "Inter-IIIT Sports Meet 2026 logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "9th Inter-IIIT Sports Meet 2026",
    description: "The All India Inter-IIIT Sports Meet hosted by IIITDM Kancheepuram.",
    images: ["/assets/brand/inter-iiit-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="google-site-verification" content="bU1L_ZRG-giabNdHlC6ktOparSgIZQAmGhm0qPHF7XE" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col" style={{ background: '#faf6ee' }}>
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
