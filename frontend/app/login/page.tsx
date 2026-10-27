import type { Metadata } from "next";
import { LoginForm } from "../components/account";

export const metadata: Metadata = { title: "Sign in — Mando" };

export default function Page() { return <LoginForm />; }
