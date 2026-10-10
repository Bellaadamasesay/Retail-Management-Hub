import { requireUser } from "@/server/auth";
import { handle, type Params } from "@/server/http";
import { setAccess } from "@/server/users";

export const POST = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("users.manage");
  const { id } = await params;
  return setAccess(id, true, user.id);
});
