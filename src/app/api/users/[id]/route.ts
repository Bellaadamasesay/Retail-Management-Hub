import type { UserInput } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { handle, readJson, type Params } from "@/server/http";
import { updateUser } from "@/server/users";

export const PUT = handle(async (request, { params }: Params<"id">) => {
  const user = await requireUser("users.manage");
  return updateUser((await params).id, await readJson<UserInput>(request), user.id);
});
