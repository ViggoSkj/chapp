import type { Metadata } from "next";
import { SentenceExercise } from "../components/sentence-exercise";

export const metadata: Metadata = {
  title: "Daily practice — Mando",
};

export default function Page() {
  return <SentenceExercise practiceQueue />;
}
