import PageHeader from "@/components/PageHeader";
import BracketsBoard from "@/components/live/brackets/BracketsBoard";

export const metadata = {
  title: "Brackets",
  description: "Pool standings, match logs and knockout brackets of the 9th All India Inter-IIIT Sports Meet 2026.",
  alternates: { canonical: "/brackets" },
};

const VIEWS = ["bracket", "schedule", "list"];

export default async function BracketsPage({ searchParams }) {
  const params = await searchParams;
  // ?t=3&view=schedule is kept in the link, so a view can be shared.
  const tournament = /^\d{1,9}$/.test(params?.t || "") ? Number(params.t) : null;
  const view = VIEWS.includes(params?.view) ? params.view : "bracket";
  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Brackets"
        label="Follow"
        badgeLabel="Knockout"
        description="Pool standings, every match and the road to the final, sport by sport. Updates on its own; times are in IST."
      />
      <BracketsBoard initialTournament={tournament} initialView={view} />
    </div>
  );
}
