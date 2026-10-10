import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { directory } from "@/server/users";

/** Names only, so any screen can say who did something. */
export const GET = handle(async () => {
  await requireUser();
  return directory();
});
