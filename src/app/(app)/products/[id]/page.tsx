import type { Metadata } from "next";
import { ProductEditor } from "@/features/catalog/components/product-editor";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}
