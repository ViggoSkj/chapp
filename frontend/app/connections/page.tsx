import type { Metadata } from "next";
import { Connections } from "../components/connections";

export const metadata: Metadata = { title: "Connections — Mando" };

export default function Page() { return <Connections />; }
