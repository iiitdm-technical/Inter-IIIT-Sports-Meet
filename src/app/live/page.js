import PageHeader from "@/components/PageHeader";
import LiveBoard from "@/components/live/LiveBoard";
import { LIVE_IIITS, liveSports } from "@/lib/live/catalog";

export const metadata = {
  title: "Live Results",
  description: "Live scores, upcoming matches, results and the medal tally of the 9th All India Inter-IIIT Sports Meet 2026.",
  alternates: { canonical: "/live" },
};

const pick = (value, allowed) => (typeof value === "string" && allowed.includes(value) ? value : "");

export default async function LivePage({ searchParams }) {
  const sports = liveSports().map(({ id, name }) => ({ id, name }));
  const iiits = LIVE_IIITS.map(({ code, name }) => ({ code, name }));
  const params = await searchParams;
  // Filters in the link (?sport=football&iiit=iiit-kota) are kept, so a view can be shared.
  const initialFilters = {
    sport: pick(params?.sport, sports.map((s) => s.id)),
    gender: pick(params?.gender, ["M", "F", "mixed"]),
    iiit: pick(params?.iiit, iiits.map((i) => i.code)),
  };
  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Live Results"
        label="Follow"
        badgeLabel="Live"
        description="Scores update on their own every few seconds. Times are in IST."
      />
      <LiveBoard sports={sports} iiits={iiits} initialFilters={initialFilters} />
    </div>
  );
}
