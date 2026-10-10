import { requireUser } from "@/server/auth";
import { created, handle, readJson } from "@/server/http";
import { listIntakes, receiveIntake, type IntakeBody } from "@/server/stock";

export const GET = handle(async () => {
  await requireUser("inventory.intake");
  return listIntakes();
});

export const POST = handle(async (request) => {
  const user = await requireUser("inventory.intake");
  return created(await receiveIntake(await readJson<IntakeBody>(request), user.id));
});
