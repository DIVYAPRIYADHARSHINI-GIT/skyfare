import type { Metadata } from "next";
import { AboutView } from "./AboutView";

export const metadata: Metadata = { title: "About & model insights" };

export default function AboutPage() {
  return <AboutView />;
}
