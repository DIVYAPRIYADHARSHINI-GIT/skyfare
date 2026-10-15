import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { BudgetView } from "./BudgetView";

export const metadata: Metadata = { title: "Budget mode" };

export default function BudgetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BudgetView />
    </Suspense>
  );
}
