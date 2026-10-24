import type { Metadata } from "next";
import { LanguagePractice } from "../components/language-practice";

export const metadata: Metadata = { title: "Sentence practice — Mando" };

export default function Page() {
  return <LanguagePractice kind="sentences" />;
}
