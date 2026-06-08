# SOQL Migration — gviz CSV → Salesforce SOQL

**Status:** Spec only. Wire up after the current Sheet-backed version ships and SF service-account creds are available.

This document describes how to swap the dashboard's data source from the linked Google Sheet (`gviz` CSV) to direct Salesforce SOQL, without touching anything downstream of `fetchReport` / `fetchExpansion`.

---

## 1. Strategy

- **Boundary:** only `lib/data/fetchReport.ts` and `lib/data/fetchExpansion.ts` change. The shape they return (`{ rows: Row[], fetchedAt: string }`) stays identical, so `metrics.ts`, `filters.ts`, `applyFilters`, all components, and the `effective_csm` derivation in `fetchReport`'s normalize step are untouched.
- **Auth:** reuse the same `jsforce` setup pattern as `revenue-os/dashboard/src/lib/salesforce.ts`. Use a **service-account Connected App** (Client Credentials flow), not per-user OAuth — this is a read-only org-wide dataset, every viewer sees the same numbers.
- **Rollout:** behind a `DATA_SOURCE=sheet|sf` env var. Default to `sheet` for a week; switch one row at a time and reconcile.

---

## 2. The SOQL query

The Salesforce report this replaces has these filters: `Show Me = All opportunities`, `Close Date = Current and Next FY`, `Opportunity Status = Any`, `Probability = All`, and the boolean expression `(1 OR (5 AND 6)) AND 2 AND 3 AND 4 AND 7` over the 7 row-level conditions captured in `lib/data/fetchReport.spec.md` (TBD) and translated below.

```sql
SELECT
  Id,
  Name,
  Account.Name,
  Owner.Name,
  Type,
  StageName,
  ForecastCategoryName,
  Renewal_Status__c,
  Renewal_Type__c,
  CloseDate,
  Amount,
  Multi_Year_Deal__c,
  Prior_Contract_Value__c,
  Annual_Contract_Value__c,
  Upgrade_Downgrade_Amount__c,
  CreatedDate,
  Contract_Start_Date__c,
  Contract_End_Date__c,
  FiscalPeriodId,
  Account_Segment__c,
  Total_Contract_Value__c,
  Churn_Risk_Flag__c,
  Churn_Risk_Category__c,
  Churn_Risk_Sub_Category__c,
  Churn_Risk_Notes__c,
  Opportunity_contract_start_quarter__c,
  Opp_closed_date_quarter__c,
  CSM__c,

  -- The 15 numeric inputs that feed all 13 metrics:
  To_include_in_NRR__c,
  To_include_in_GRR_v2__c,
  NRR_Base__c,
  Base_GRR__c,
  NRR_actuals__c,
  GRR_actuals__c,
  ARR_High_Risk_Renewal__c,
  ARR_Expected_Churn__c,
  Expansion_contri__c,
  ARR_PriorCV_Closed_Renewal_only__c,
  ARR_PriorCV_Expected_Churn__c,
  ARR_PriorCV_High_Risk_Renewal__c,
  ARR_PriorCV_churned__c,
  Embedded_renewal_uplift_amt__c,
  closed_won_ARR__c,

  -- Bonus / nice-to-have if present, otherwise drop:
  YTD_NRR_actuals__c,
  YTD_GRR_actuals__c,
  NRR_Base_YTD__c,
  Base_GRR_YTD__c,
  Renewals_due_YTD__c,
  Renewals_closed_YTD__c,
  NRR_Base_Open_Opp__c,
  ARR_churned__c,
  ARR_Closed_Renewal_only__c
FROM Opportunity
WHERE
  -- Close Date: Current + Next FY. SF date literals roll year-over-year.
  (CloseDate = THIS_FISCAL_YEAR OR CloseDate = NEXT_FISCAL_YEAR)

  -- (1 OR (5 AND 6)): Renewals (any allowed stage) OR Expansion (Contracting / Closed Won only)
  AND (
    Type = 'Renewals'
    OR (Type = 'Expansion' AND StageName IN ('Contracting', 'Closed Won'))
  )

  -- 2: Deal Name exclusions
  AND NOT (Name LIKE '%zuddl%')
  AND NOT (Name LIKE '%Renewal test - 2026%')
  AND NOT (Name LIKE '%2024%')
  AND NOT (Name LIKE '%Harsh%')
  AND NOT (Name LIKE '%Rushabh%')

  -- 3: Stage allow-list (applies AND-wise, so it also constrains the Renewals branch)
  AND StageName IN (
    'Contracting',
    'Closed Won',
    'Closed Lost',
    'Dead Lost',
    'Renewal Anticipation',
    'Proposal Discussion',
    'Renewal Confirmation'
  )

  -- 4: Account Name exclusions
  AND NOT (Account.Name LIKE '%saaswin%')
  AND NOT (Account.Name LIKE '%rushabh%')

  -- 7: Opportunity Owner exclusions
  AND NOT (Owner.Name LIKE '%Harsh%')
  AND NOT (Owner.Name LIKE '%Aakanksha%')
  AND NOT (Owner.Name LIKE '%Rushabh%')

ORDER BY CloseDate ASC
LIMIT 2000
```

### Notes on the query

- **`THIS_FISCAL_YEAR` / `NEXT_FISCAL_YEAR`** are SF date literals — they resolve against the org's fiscal-year setting at query time. Don't hardcode 2026/2027 dates or the dashboard will go stale on Jan 1.
- **`LIKE` is case-insensitive** in SOQL. `'%harsh%'` matches `Harsh`, `HARSH`, `harsh`. Matches the SF report's `does not contain` semantics exactly.
- **The exclusion lists are substring matches**, so `'%Harsh%'` will also exclude `Harshad`, `Harshvardhan`, etc. The SF report does the same — kept for parity.
- **`LIMIT 2000`** is a safety belt; current row count is ~150 so we're fine. Bump or paginate if it ever grows past that.

### Expansion query (separate Sheet today)

A near-identical query against the same object, filtered to `Type = 'Expansion'` with whatever filter the expansion-report Sheet uses. TBD — capture the expansion-report SF filter expression and translate it the same way before swapping `fetchExpansion`.

---

## 3. Field mapping (SF API → Row column name)

The downstream code reads rows by the column names defined in the gviz CSV header. The new fetcher must produce a `Row` with the same keys. Most are straight passes; a handful need rename:

| SF SOQL field | `Row` column key | Notes |
|---|---|---|
| `Id` | `Opportunity Id` | New — not currently in Sheet, harmless to add |
| `Name` | `Deal Name` | Rename |
| `Account.Name` | `Account Name` | Rename (relationship traversal) |
| `Owner.Name` | `Opportunity Owner` | Rename (relationship traversal) |
| `Type` | `Type` | Same |
| `StageName` | `Stage` | Rename |
| `ForecastCategoryName` | `Forecast Category` | Rename |
| `Renewal_Status__c` | `Renewal Status` | Rename |
| `Renewal_Type__c` | `Renewal Type` | Rename |
| `CloseDate` | `Close Date (2)` | Rename — keep the `(2)` so existing parsing keeps working, or rename to `Close Date` and update one constant |
| `Amount` | `Amount` | Same |
| `Multi_Year_Deal__c` | `Multi-year deal?` | Rename |
| `Prior_Contract_Value__c` | `Prior Contract Value` | Rename |
| `Annual_Contract_Value__c` | `Annual Contract Value (ACV)` | Rename |
| `Upgrade_Downgrade_Amount__c` | `Upgrade/Downgrade Amount` | Rename |
| `CreatedDate` | `Created Date` | Rename |
| `Contract_Start_Date__c` | `Contract Start Date` | Rename |
| `Contract_End_Date__c` | `Contract End Date` | Rename |
| `Account_Segment__c` | `Account Segment` | Rename |
| `Total_Contract_Value__c` | `[TCV] Total Contract Value` | Rename |
| `Churn_Risk_Flag__c` | `Churn Risk Flag` | Rename |
| `Churn_Risk_Category__c` | `Churn Risk Category` | Rename |
| `Churn_Risk_Sub_Category__c` | `Churn Risk Sub-Category` | Rename |
| `Churn_Risk_Notes__c` | `Churn Risk Notes` | Rename |
| `Opportunity_contract_start_quarter__c` | `Opportunity_contract_start_quarter` | Strip `__c` |
| `Opp_closed_date_quarter__c` | `Opp_closed_date_quarter` | Strip `__c` |
| `CSM__c` | `CSM` | Strip `__c` |
| `To_include_in_NRR__c` | `Projected NRR (numerator)` | Rename (matches RENAME_MAP entry already in code) |
| `To_include_in_GRR_v2__c` | `Projected GRR (numerator)` | Rename (matches RENAME_MAP entry already in code) |
| `NRR_Base__c` | `NRR_Base` | Strip `__c` |
| `Base_GRR__c` | `Base_GRR` | Strip `__c` |
| `NRR_actuals__c` | `NRR_actuals` | Strip `__c` |
| `GRR_actuals__c` | `GRR_actuals` | Strip `__c` |
| `ARR_High_Risk_Renewal__c` | `ARR_High_Risk_Renewal` | Strip `__c` |
| `ARR_Expected_Churn__c` | `ARR_Expected_Churn` | Strip `__c` |
| `Expansion_contri__c` | `Expansion_contri` | Strip `__c` |
| `ARR_PriorCV_Closed_Renewal_only__c` | `ARR_PriorCV_Closed_Renewal_only__c` | Keep `__c` (matches existing RENAME_MAP) |
| `ARR_PriorCV_Expected_Churn__c` | `ARR_PriorCV_Expected_Churn__c` | Keep `__c` |
| `ARR_PriorCV_High_Risk_Renewal__c` | `ARR_PriorCV_High_Risk_Renewal__c` | Keep `__c` |
| `ARR_PriorCV_churned__c` | `ARR_PriorCV_churned__c` | Keep `__c` |
| `Embedded_renewal_uplift_amt__c` | `Embedded_renewal_uplift_amt` | Strip `__c` |
| `closed_won_ARR__c` | `closed_won_ARR` | Strip `__c` |

After the rename in the new `fetchReport`, the existing `RENAME_MAP` (lib/data/types.ts) takes over for the same 6 canonical-name normalizations the gviz path uses today — no change needed there.

### Field-name verification before flipping the switch

Two SOQL queries to run in Workbench / sf CLI to confirm the API names above match your org:

```sql
-- Custom fields on Opportunity (all the __c ones)
SELECT QualifiedApiName, Label
  FROM FieldDefinition
 WHERE EntityDefinition.QualifiedApiName = 'Opportunity'
   AND QualifiedApiName LIKE '%__c'

-- Standard / relationship fields used (sanity)
SELECT Id FROM Opportunity LIMIT 1
```

If any `__c` name is different (e.g. `Multi_Year_Deal__c` is actually `MultiYear__c` in your org), update the `SELECT` and the rename table — nothing else changes.

---

## 4. Auth setup

### Connected App (one-time, in Salesforce)

1. **Setup → App Manager → New Connected App.**
2. **API (Enable OAuth Settings):**
   - Callback URL: `http://localhost:3000` (placeholder; not used by Client Credentials).
   - Selected OAuth Scopes: `api`, `refresh_token`, `offline_access`.
   - **Enable Client Credentials Flow** (Lightning Experience → App Manager → Manage Connected Apps → your app → "Edit Policies" → "Enable Client Credentials Flow").
   - Set **Run As User** to a dedicated service-account SF user with read access to all the fields above.
3. **Save**, then on the Connected App detail page copy the **Consumer Key** and **Consumer Secret**.

### Service-account user permissions

The Run-As user needs a permission set or profile that grants read on:
- Standard Opportunity fields (`Name`, `Account.Name`, `Owner.Name`, `Type`, `StageName`, etc.)
- Every custom field listed in §3
- Account read (for `Account.Name`)
- User read (for `Owner.Name`)

If you have a "Read-only Analyst" permission set already, attach that.

### Env vars

```bash
# csm-dashboard-temp/.env.local (gitignored)
SF_LOGIN_URL=https://login.salesforce.com         # or zuddl-specific my-domain URL
SF_CLIENT_ID=<Consumer Key from Connected App>
SF_CLIENT_SECRET=<Consumer Secret from Connected App>
DATA_SOURCE=sf                                     # toggle: 'sheet' (current) | 'sf'
```

---

## 5. Code skeleton for `fetchReport.ts` (SF flavor)

Not committed yet. When ready, the file looks roughly like:

```typescript
import jsforce from "jsforce";
import { CSM_LIST } from "../constants";
import type { Row } from "./types";
import { RENAME_MAP, RAW_NUMERIC_COLS } from "./types";

// Same canonical-naming normalize step as the gviz path. Re-export from a
// shared helper so both fetchers stay in sync.
import { normalize, coerceNumeric } from "./normalize";

const SOQL = `... the query from §2 ...`;

// Single-process token cache. Client Credentials returns short-lived access
// tokens; re-acquire when expired.
let cachedConn: { conn: jsforce.Connection; expiresAt: number } | null = null;

async function getConn(): Promise<jsforce.Connection> {
  const now = Date.now();
  if (cachedConn && now < cachedConn.expiresAt - 60_000) return cachedConn.conn;
  const res = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SF_CLIENT_ID!,
      client_secret: process.env.SF_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`SF auth failed: ${res.status}`);
  const { access_token, instance_url, expires_in = 3600 } = await res.json();
  const conn = new jsforce.Connection({ accessToken: access_token, instanceUrl: instance_url });
  cachedConn = { conn, expiresAt: now + expires_in * 1000 };
  return conn;
}

// Field rename layer: SOQL records → Row shape that downstream code expects.
const FIELD_TO_ROW_KEY: Record<string, string> = {
  Name: "Deal Name",
  "Account.Name": "Account Name",
  "Owner.Name": "Opportunity Owner",
  StageName: "Stage",
  // ... full mapping from §3 ...
};

function recordToRow(rec: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [sf, rowKey] of Object.entries(FIELD_TO_ROW_KEY)) {
    // Handle `Account.Name`-style nested traversal:
    const parts = sf.split(".");
    let v: any = rec;
    for (const p of parts) v = v?.[p];
    row[rowKey] = v == null ? null : String(v);
  }
  return row;
}

export async function fetchReportFromSf(): Promise<{ rows: Row[]; fetchedAt: string }> {
  const conn = await getConn();
  const result = await conn.query(SOQL);
  const fetchedAt = new Date().toISOString();
  const rawRows = result.records.map(recordToRow);
  // Same normalize step as the gviz path: numeric coercion, RENAME_MAP,
  // effective_csm derivation.
  return { rows: normalize(rawRows), fetchedAt };
}

// Top-level dispatcher used by app/page.tsx — no change to its caller.
export async function fetchReport() {
  if (process.env.DATA_SOURCE === "sf") return fetchReportFromSf();
  // Fall through to the existing gviz fetch.
  return fetchReportFromSheet();
}
```

The only refactor needed in the existing code: extract the post-fetch `normalize` step out of the current `fetchReport.ts` into a shared helper (e.g. `lib/data/normalize.ts`) so both fetchers can call it.

---

## 6. Validation checklist before cutover

Run with `DATA_SOURCE=sheet` AND `DATA_SOURCE=sf` side-by-side and diff:

- [ ] Row count matches (±0; if SF has more, the report's filter is wider than what we translated)
- [ ] `SUM(NRR_Base)` matches within $1
- [ ] `SUM(Base_GRR)` matches within $1
- [ ] `SUM(closed_won_ARR)` matches within $1
- [ ] `SUM(ARR_High_Risk_Renewal)` matches within $1
- [ ] `SUM(ARR_Expected_Churn)` matches within $1
- [ ] Distinct `Opportunity Owner` values match
- [ ] Distinct `Opp_closed_date_quarter` values match
- [ ] `% GRR Gap` tile matches (to 0.1%)
- [ ] `% NRR Gap` tile matches (to 0.1%)
- [ ] All 13 derived metrics match aggregate-wide (within 0.5% rounding)

If any of those drift, the most likely culprits are: (a) a field rename you missed, (b) `Renewal_Status__c` not matching the report's `Renewal Status` column exactly, or (c) the boolean filter expression diverging — replay the SF report and compare row-by-row by `Id`.

Once everything matches, flip `DATA_SOURCE=sf` permanently and delete the gviz fetcher in a follow-up PR.
