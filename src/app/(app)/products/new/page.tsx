import type { Metadata } from "next";
import { Forbidden } from "@/components/shell/forbidden";
import { ProductForm } from "@/features/catalog/components/product-form";
import { getSession } from "@/lib/auth/server";
import { can } from "@/lib/rbac/permissions";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  // Cashiers can look at products but not create them.
  const session = await getSession();
  if (!can(session?.role, "products.edit")) return <Forbidden />;
  return <ProductForm />;
}
