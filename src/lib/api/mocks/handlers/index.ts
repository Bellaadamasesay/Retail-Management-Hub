import { HttpResponse } from "msw";
import type { ReportRun } from "../../types";
import { getDb, saveDb } from "../db";
import { actorOf, fail, NOW, route } from "./common";
import { productHandlers } from "./products";
import { salesHandlers } from "./sales";
import { stockHandlers } from "./stock";
import { userHandlers } from "./users";

/** Every mock endpoint, one file per area of the product. */
export const handlers = [
  ...productHandlers,
  ...stockHandlers,
  ...salesHandlers,
  ...userHandlers,

  route.get("/api/reports/runs", () => HttpResponse.json(getDb().reportRuns)),

  /** Log that a report was generated or exported, so it shows under Recent Reports. */
  route.post("/api/reports/runs", async ({ request }) => {
    const body = (await request.json()) as Omit<ReportRun, "id" | "at" | "generatedBy">;
    if (!body.name || !body.type || !body.from || !body.to) return fail(422, "Missing report details.");
    const db = getDb();
    const run: ReportRun = { ...body, id: `rr-${db.reportRuns.length + 1}`, at: NOW(), generatedBy: actorOf(request) };
    db.reportRuns.unshift(run);
    saveDb();
    return HttpResponse.json(run, { status: 201 });
  }),
];
