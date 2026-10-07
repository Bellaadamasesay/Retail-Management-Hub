import type { Metadata } from "next";
import { Forbidden } from "@/components/shell/forbidden";

export const metadata: Metadata = { title: "No access" };

export default function ForbiddenPage() {
  return <Forbidden />;
}
