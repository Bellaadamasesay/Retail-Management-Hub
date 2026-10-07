import type { Metadata } from "next";
import { PosView } from "@/features/pos/components/pos-view";

export const metadata: Metadata = { title: "Sales / POS" };

export default function PosPage() {
  return <PosView />;
}
