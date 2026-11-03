import type { Metadata } from "next";
import { ProgressDashboard } from "../components/progress";

export const metadata: Metadata = {
  title: "Your progress — Mando",
};

export default function Page() {
  return <ProgressDashboard />;
}
