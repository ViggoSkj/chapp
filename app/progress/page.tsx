import type { Metadata } from "next";
import { DetailPage } from "../components/workspace";

export const metadata: Metadata = {
  title: "Your progress — Mando",
};

export default function Page() {
  return <DetailPage section="progress" />;
}
