import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { availability } from "@/server/stock";

/** Live stock for the cart: { [variantId]: unitsOnShelf }. */
export const GET = handle(async (request) => {
  await requireUser();
  const ids = (new URL(request.url).searchParams.get("variantIds") ?? "").split(",").filter(Boolean).slice(0, 200);
  return availability(ids);
});
