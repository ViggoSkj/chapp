import type { Metadata } from "next";
import { DetailPage } from "../components/workspace";

export const metadata: Metadata = {
  title: "Vocabulary — Mando",
};

export default function Page() {
  return <DetailPage section="vocabulary" />;
}
