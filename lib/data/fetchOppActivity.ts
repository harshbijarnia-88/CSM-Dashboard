/**
 * Client-side fetcher for per-opportunity activity rollups.
 *
 * Calls the revenue-os endpoint `/api/csm/opp-activity` with a batch of SF
 * Opportunity IDs and returns a map keyed by id. Used by the Expansion (and
 * eventually Renewal) opportunity tables to render the "Last Activity"
 * cell + the per-row activity tooltip with data sourced from Postgres
 * rather than SF's coarse `LastActivityDate`.
 *
 * The base URL is configurable via `NEXT_PUBLIC_REVENUE_OS_URL`. Default
 * `http://localhost:3000` matches the local dev setup where the iframe
 * parent at port 3000 is also where this API lives. On the public Vercel
 * deploy of csm-dashboard-temp, the env var should point at the deployed
 * revenue-os origin (or be left unset so the fetcher fails soft and the
 * table falls back to the sheet's `Last Activity` column).
 */

export type OppActivityRollup = {
  opportunityId: string;
  lastActivityAt: string | null;
  lastOutboundEmailAt: string | null;
  lastInboundEmailAt: string | null;
  lastMeetingAt: string | null;
  lastCanceledMeetingAt: string | null;
  outboundEmails14d: number;
  inboundEmails14d: number;
  calls14d: number;
  meetings14d: number;
  canceledOrNoShowMeetings14d: number;
  linkedin14d: number;
  engageSteps14d: number;
  otherTasks14d: number;
  totalTouches14d: number;
};

const BASE_URL =
  process.env.NEXT_PUBLIC_REVENUE_OS_URL ?? "http://localhost:3000";

/**
 * POST a batch of opportunity IDs to the revenue-os activity endpoint.
 * Returns an empty record if the endpoint is unreachable / errors out, so
 * the caller can render the table normally even when revenue-os isn't
 * running (e.g. on the standalone Vercel deploy).
 */
export async function fetchOppActivity(
  opportunityIds: string[],
): Promise<Record<string, OppActivityRollup>> {
  const ids = Array.from(
    new Set(opportunityIds.map((id) => id?.trim()).filter(Boolean)),
  );
  if (ids.length === 0) return {};

  try {
    const res = await fetch(`${BASE_URL}/api/csm/opp-activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ opportunityIds: ids }),
    });
    if (!res.ok) {
      // Quietly degrade: 401 (not logged into revenue-os), 5xx (DB down),
      // or anything else — the table just renders without activity data.
      return {};
    }
    const json = (await res.json()) as {
      activity?: Record<string, OppActivityRollup>;
    };
    return json.activity ?? {};
  } catch {
    // Network error — fail soft.
    return {};
  }
}
