import type { Metadata } from "next";
import { LanguagePractice } from "../components/language-practice";

export const metadata: Metadata = { title: "Listening practice — Mando" };

export default function Page() {
  return <LanguagePractice kind="listening" />;
}
