import type { Metadata } from "next";
import { DetailPage } from "../components/workspace";

export const metadata: Metadata = {
  title: "Anki reviews — Mando",
};

export default function Page() {
  return <DetailPage section="reviews" />;
}
