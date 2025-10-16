"use client";

import NextDynamic from "next/dynamic";

/** Keep this in sync with the server type */
export type Agent = {
  name: string;
  website: string;
  regions: string[];
  logo?: string;
  lat: number;
  lng: number;
  email?: string;
  address?: string;
  license?: string; // PRSA
};

// IMPORTANT: path matches the file below
const AgentsMap = NextDynamic(
  () => import("@/components/agents/AgentsMapClient"),
  { ssr: false }
);

export default function AgentsPageClient({ agents }: { agents: Agent[] }) {
  // Fill the grid row; avoid forcing viewport heights here
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <AgentsMap agents={agents} />
    </div>
  );
}
