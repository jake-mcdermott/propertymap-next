// src/app/page.tsx
import { Suspense } from "react";
import BootSplash from "@/components/layout/Bootsplash";
import HomeClient from "@/components/layout/HomeClient";

// If you want to force dynamic (no static export), you can also add:
// export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<BootSplash />}>
      <HomeClient />
    </Suspense>
  );
}
