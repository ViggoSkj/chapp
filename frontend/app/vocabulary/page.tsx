import type { Metadata } from "next";
import { Vocabulary } from "../components/vocabulary";

export const metadata: Metadata = { title: "Vocabulary — Mando" };

export default function Page() {
  return <Vocabulary />;
}
