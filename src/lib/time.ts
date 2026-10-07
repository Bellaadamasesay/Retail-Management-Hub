import { FIXTURE_NOW } from "@/lib/api/fixtures/now";

const mocking = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
const loadedAt = Date.now();

/**
 * The app's idea of "now". With the mock API on, the clock starts at the
 * fixture date (so the seeded sales line up with "today") and then ticks in
 * real time; with a real backend it is simply the current time.
 */
export function appNow(): Date {
  return mocking ? new Date(FIXTURE_NOW.getTime() + (Date.now() - loadedAt)) : new Date();
}
