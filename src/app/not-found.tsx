import type { Metadata } from "next";
import { NotFound } from "@/core/NotFound";

export const metadata: Metadata = { title: "Not found | Refill" };

export default function NotFoundPage() {
  return <NotFound />;
}
