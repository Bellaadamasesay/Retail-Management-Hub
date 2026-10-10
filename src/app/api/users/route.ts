import type { UserInput } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { created, handle, readJson } from "@/server/http";
import { createUser, listUsers } from "@/server/users";

export const GET = handle(async () => {
  await requireUser("users.manage");
  return listUsers();
});

/** Adds someone and returns their temporary password (and PIN, for cashiers) once, to read out. */
export const POST = handle(async (request) => {
  const user = await requireUser("users.manage");
  return created(await createUser(await readJson<UserInput>(request), user.id));
});
