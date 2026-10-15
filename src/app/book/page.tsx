import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { BookView } from "./BookView";

export const metadata: Metadata = { title: "Book your flight" };

export default function BookPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BookView />
    </Suspense>
  );
}
