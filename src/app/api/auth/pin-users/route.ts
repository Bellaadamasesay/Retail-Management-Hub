import { handle } from "@/server/http";
import { pinUsers } from "@/server/users";

/** Names for the PIN picker on shared tills (no emails or roles). Open before sign-in, by design. */
export const GET = handle(() => pinUsers());
