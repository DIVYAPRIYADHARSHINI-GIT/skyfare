import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { PredictView } from "./PredictView";

export const metadata: Metadata = { title: "Price prediction" };

export default function PredictPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PredictView />
    </Suspense>
  );
}
