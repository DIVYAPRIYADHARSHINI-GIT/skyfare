import type { Metadata } from "next";
import { TripsView } from "./TripsView";

export const metadata: Metadata = { title: "My trips" };

export default function TripsPage() {
  return <TripsView />;
}
