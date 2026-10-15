import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = { title: "Flight results" };

export default function ResultsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResultsView />
    </Suspense>
  );
}
