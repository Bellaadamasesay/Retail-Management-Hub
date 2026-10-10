import { requireUser } from "@/server/auth";
import { handle, type Params } from "@/server/http";
import { resetPin } from "@/server/users";

export const POST = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("users.manage");
  const { id } = await params;
  return resetPin(id, user.id);
});
