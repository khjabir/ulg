import type { Metadata } from "next";
import { NotFound } from "@/core/NotFound";

export const metadata: Metadata = { title: "Not found | ulg" };

export default function NotFoundPage() {
  return <NotFound />;
}
