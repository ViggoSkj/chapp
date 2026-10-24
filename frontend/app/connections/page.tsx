import type { Metadata } from "next";
import { DetailPage } from "../components/workspace";

export const metadata: Metadata = {
  title: "Connections — Mando",
};

export default function Page() {
  return <DetailPage section="connections" />;
}
