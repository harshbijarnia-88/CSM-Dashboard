# CSM Book of Business — Business Requirements Document

**Status:** Draft v0.1 · **Date:** 2026-05-27 · **Owner:** Harsh Bijarnia
**Scope:** Extending the dashboard with a three-layer memory model, automated weekly summaries to Slack, executive WoW comparisons on the homepage, and a v2 Claude chat layer.
**Related docs:** [DASHBOARD_SPEC.md](DASHBOARD_SPEC.md) (metric catalog), [KIRO_PROMPT.md](KIRO_PROMPT.md) (frontend build brief), [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) (field reference).

---

## 1. Executive summary

We have a working Streamlit replica of the SF "CSM Book of Business" dashboard reading from a linked Google Sheet, with the Next.js frontend now being built in Kiro per `KIRO_PROMPT.md`. That covers **today's** view of GRR / NRR / risk / actuals.

What's missing is **time** and **context**: the CSMs and leadership can't see what *changed*, why, or what the weekly trajectory looks like, and there's no automated push notification when something material moves. This BRD scopes a three-layer memory system, a weekly Slack digest, an executive WoW summary on the homepage, and (v2) a Claude chat over the whole stack.

---

## 2. Background and current state

| Component | Status | Notes |
|---|---|---|
| Live SF dashboard | Production | Slow refresh, no drill-down |
| Streamlit replica (`app.py`) | Built | 13 widgets, matches SF "All" totals on 7/8 tiles |
| Next.js dashboard (Kiro) | In flight | Spec'd in `KIRO_PROMPT.md`, build pending |
| 15 input fields + 13 metric formulas | Locked | See `DASHBOARD_SPEC.md` |
| Snapshot history | **Missing** | This BRD addresses |
| Weekly Slack digest | **Missing** | This BRD addresses |
| Conversational layer | **v2** | This BRD scopes |

---

## 3. Goals and non-goals

### In scope
- Persist a **weekly point-in-time snapshot** of the SF report + computed metrics every Wednesday.
- Maintain a **context memory** layer that records WoW diffs and the weekly CSM↔CEO/CSM-Head sync transcript.
- Show an **executive summary** at the top of the dashboard with WoW deltas + LLM-generated highlights.
- Post a **weekly Slack digest** to `#post-sales-help` with recommendations and what changed.
- Author a **business-logic doc** describing each field, its significance, and the computation order.
- **v2:** Anthropic-powered chat over the three memory layers (Claude API with prompt caching).

### Out of scope (for v1)
- Anomaly alerts more granular than weekly.
- Editable targets (95% / 110% stays hardcoded).
- Forecast modelling / scenario simulation.
- Multi-tenant support — single-team install.
- Mobile-native app.

---

## 4. Users

| Persona | Frequency | Use case |
|---|---|---|
| CSM (×4) | Daily | "How's my book? What's at risk?" |
| Head of CS | Weekly | "Where are we vs target? Who needs help?" |
| CEO | Weekly | Reads the Slack digest; opens dashboard for deeper review |
| RevOps / Analyst | Ad hoc | Diagnoses weird movements |

---

## 5. Functional requirements

### 5.1 Memory layer 1 — Live state *(exists)*
- **Source:** Google Sheet, `gviz` CSV endpoint.
- **Cadence:** Dashboard re-fetches every 10 min (`revalidate: 600`).
- **Format:** In-memory only.
- **Owner of data freshness:** SF Sheet Connector inside Salesforce.

### 5.2 Memory layer 2 — Weekly historical snapshot *(new)*

- **Trigger:** Cron, every **Wednesday at 09:00 IST**.
- **What gets captured per snapshot:**
  1. Full normalized row set after the cleanup pipeline (subtotal-row drop, numeric coercion, column rename).
  2. All 13 derived metrics at three cuts: aggregate, per-CSM, per-quarter, per-CSM × quarter.
  3. Metadata: snapshot timestamp, ISO week, data row count, distinct CSMs, schema fingerprint.
- **Format:** **JSON, not CSV**, because the LLM consumes it. Gzip on write.
- **Storage:** See `§7.3`. Default plan: `snapshots/<YYYY>-W<WW>.json.gz`.
- **Idempotency:** if Wednesday's snapshot already exists, the job no-ops with a log line. Re-runnable.
- **Retention:** keep all weekly snapshots forever (size estimate below). Manual archive policy later.

**Schema (one snapshot):**

```json
{
  "snapshot_id": "2026-W22",
  "captured_at": "2026-05-27T09:00:00+05:30",
  "source": {
    "sheet_id": "1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o",
    "row_count": 131,
    "schema_fingerprint": "sha256:…"
  },
  "csms": ["Aastha Jindal", "Bhargav Prasad", "Janhvi Gupta", "Joe Huisman"],
  "metrics": {
    "aggregate": { "grr_pct": 0.909, "nrr_pct": 0.995, "...": 0 },
    "by_csm":      { "Aastha Jindal": { "grr_pct": 0.78, "...": 0 }, "...": {} },
    "by_quarter":  { "Q1 CY2026": { "grr_pct": 0.66, "...": 0 }, "...": {} },
    "by_csm_quarter": { "Aastha Jindal||Q1 CY2026": { "grr_pct": 0.704 }, "...": {} }
  },
  "rows": [ { "opportunity_id_or_deal_name": "...", "...": "..." } ]
}
```

Size estimate: ~150 rows × ~50 fields ≈ 200 KB JSON, ~25 KB gzipped. 52 weeks = ~1.3 MB/year. Trivial.

### 5.3 Memory layer 3 — Context memory *(new)*

Separate from the raw snapshot. Captures *interpretation*: what changed, what was discussed.

- **Trigger:** Built immediately after each weekly snapshot.
- **Format:** JSON.
- **Storage:** `context/<YYYY>-W<WW>.json`.
- **Contents per week:**
  - `metric_diffs`: WoW change for every tile (absolute and %).
  - `opportunity_diffs`: opps added, removed, stage-changed, forecast-changed, amount-changed.
  - `transcript`: weekly CSM↔CEO/CSM-Head sync, pulled from existing Fireflies/Gong sync. Stored as `{ source, meeting_id, attendees, raw_text, llm_summary }`.
  - `narrative`: free-form notes added manually via the dashboard (optional in v1).
  - `summary_for_slack`: the LLM-drafted summary that was posted (so we can audit it later).

### 5.4 Executive summary on the homepage *(new)*

A horizontal strip at the top of the dashboard, above the existing filter row.

**Contents:**
- Last-snapshot timestamp + week label.
- 4 KPI cards comparing **this snapshot vs last snapshot**:
  - GRR%
  - NRR%
  - Renewal Remaining
  - At-risk ARR (High Risk + Expected Churn)
- Each card shows current value, delta vs last week, and arrow direction.
- A 3-5 bullet "Highlights" block generated by Claude from the context-memory JSON.
- A "View full digest" link → expands the same Slack message inline.

### 5.5 Weekly Slack digest *(new)*

- **Channel:** `#post-sales-help` *(confirm exact channel name)*.
- **Timing:** every Wednesday, immediately after snapshot + context build.
- **Posted by:** a Slack bot using a webhook or Bolt SDK token.
- **Sections of the message:**
  1. Headline (one sentence): "GRR % moved 89.2 → 90.4 this week. NRR % flat at 99.5."
  2. Top 3 metric movements with $-impact context.
  3. Notable opp changes (newly at-risk, newly closed-won, stage drops).
  4. 2-3 generic recommendations from the LLM, e.g., "Bhargav has $X uncovered in Q2 — schedule a renewal review."
  5. Link to the dashboard.
- **Generation:** Claude API (Sonnet 4.6 is plenty for this; cheaper than Opus). Prompt cached on the field catalog + last 4 weeks of context.

### 5.6 Business-logic doc *(new — starter created)*

See [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md). It catalogs every field, its business meaning, source, and the order in which the dashboard reads, normalizes, groups, and computes.

### 5.7 v2 — Claude chat over the memory *(roadmap)*

- Sidebar chat in the dashboard.
- Tool use: query specific opps, specific metrics, specific CSMs.
- Context: all three memory layers (current Sheet + snapshots + context).
- Prompt caching aggressively to keep cost low (the snapshot history is reused on every turn).
- Out of v1 scope. Designed *into* the architecture from day one so we don't redesign later.

---

## 6. Non-functional requirements

| Concern | Requirement |
|---|---|
| Refresh cadence | Live layer: ≤ 10 min. Snapshot: weekly Wed 09:00 IST. |
| Cost | < $30/month total (LLM + hosting + storage combined for v1). |
| Privacy | Sheet is org-internal. Snapshots stored in private storage. No PII leaves Anthropic API. |
| Reliability | Snapshot job: ≥ 99% successful weeks. Failure → Slack alert. |
| Latency | Dashboard initial paint < 2s. Slack post within 60s of snapshot. |
| Auditability | Every Slack post + LLM call is logged with input/output. |
| Backwards-compat | Snapshot schema includes `schema_fingerprint` so we can detect Sheet structure changes. |

---

## 7. Architecture

### 7.1 Components

```
                     ┌───────────────────────────┐
                     │  Salesforce               │
                     │  (source of truth)        │
                     └────────────┬──────────────┘
                                  │ SF Sheet Connector
                                  ▼
                     ┌───────────────────────────┐
                     │  Google Sheet             │  ← live layer
                     │  (gviz CSV endpoint)      │
                     └────────────┬──────────────┘
                                  │ fetch + parse
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   ┌──────────────────────┐               ┌──────────────────────┐
   │  Next.js Dashboard   │               │  Snapshot Job        │
   │  (Kiro-built)        │               │  (Python, cron Wed)  │
   │                      │               │                      │
   │  • Live render       │               │  1. Fetch sheet      │
   │  • Exec summary card │◄──── reads ───┤  2. Run pipeline     │
   │  • Drill-down later  │     last 2    │  3. Compute metrics  │
   │                      │   snapshots   │  4. Write JSON       │
   └────────┬─────────────┘               │  5. Build diff       │
            │                             │  6. Pull transcript  │
            │                             │  7. LLM summarize    │
            │                             │  8. Slack post       │
            ▼                             └──────────┬───────────┘
   ┌──────────────────────┐                          │
   │  Anthropic API       │◄─────────────────────────┘
   │  (Claude Sonnet 4.6) │
   │  + prompt caching    │
   └──────────────────────┘
                                  ▲
                                  │
                     ┌────────────┴──────────────┐
                     │  JSON Storage             │
                     │  • snapshots/             │ ← layer 2
                     │  • context/               │ ← layer 3
                     │  (S3 / Supabase / repo)   │
                     └───────────────────────────┘
                                  ▲
                                  │
                     ┌────────────┴──────────────┐
                     │  Fireflies / Gong sync    │
                     │  (existing in zia-agent)  │
                     │  → weekly meeting txn     │
                     └───────────────────────────┘
```

### 7.2 Data flow per week

1. **Wed 09:00 IST.** Cron triggers `snapshot.py`.
2. Job pulls live Sheet → runs the same cleanup pipeline as the dashboard.
3. Job computes the 13 metrics at all 4 cuts (aggregate, per-CSM, per-quarter, per-CSM × quarter).
4. Job writes `snapshots/2026-W22.json.gz`.
5. Job loads the previous week's snapshot, builds `metric_diffs` + `opportunity_diffs`.
6. Job pulls the **most recent CSM↔CEO/CSM-Head sync transcript** from Fireflies (or Gong) — filter by attendees / meeting title pattern.
7. Job calls Claude (Sonnet 4.6) with: field catalog + last 4 weeks of diffs + this week's diff + transcript → returns `narrative_summary` + `slack_message`.
8. Job writes `context/2026-W22.json` with all of the above.
9. Job posts the formatted Slack message to `#post-sales-help`.
10. Dashboard's exec-summary tile reads the latest two snapshots + context on each load (cached 10 min).

### 7.3 Storage

Three options ranked by what we'd actually pick:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **GitHub repo** (commit snapshots) | Free, versioned, easy, no extra infra | Repo grows; secrets in CI can be fiddly | **Recommended for v1.** ~1.3 MB/yr is negligible. |
| Supabase / Postgres | Queryable, scales beyond JSON files later | Adds infra, separate billing | v2 if we need OLAP-style queries |
| S3 / GCS bucket | Cheapest, infinite scale | Need IAM, slightly more setup | Reasonable alternate |

**Recommendation:** v1 commits snapshots into a private branch of this repo (or a sibling `csm-dashboard-data` repo). v2 moves to Postgres only if we hit query patterns that need it.

### 7.4 LLM strategy

- **Model:** `claude-sonnet-4-6` for the weekly summary. Opus is overkill for this volume.
- **Prompt caching:** the field catalog + last 4 weeks of context get cached. Only the new week's diff + transcript is fresh tokens. Expected cost: < $0.10/week.
- **Token budget per run:** ≤ 30K cached + ≤ 8K fresh → ~$0.05/week.
- **v2 chat:** same caching strategy; Sonnet 4.6 again unless we see clear quality drop, then upgrade to Opus selectively.

---

## 8. Tech stack & external integrations

| Component | Choice | Why |
|---|---|---|
| Dashboard runtime | Next.js 14 (App Router) | Decided in `KIRO_PROMPT.md` |
| Cron / snapshot job | Python script + GitHub Actions cron | Reuses `csm-dashboard/data_loader.py` + `metrics.py`; GH Actions is free for this volume |
| Snapshot/Context storage | JSON files in private repo branch | Simplest, versioned, free |
| LLM | Anthropic Claude Sonnet 4.6 via `anthropic` SDK | Cost/quality fit; prompt caching mandatory |
| Slack | Bolt SDK with bot token (`#post-sales-help`) | Existing `Slack assistant.md` in repo |
| Meeting transcripts | Existing `fireflies-sync` or `gong-sync` | Already wired in `zia-agent` |
| Secrets | GitHub Actions secrets | No new vault needed |

---

## 9. Open decisions (need from you)

| # | Question | Default if you don't decide |
|---|---|---|
| 1 | Exact Slack channel name? | `#post-sales-help` |
| 2 | Transcript source — Fireflies or Gong? | Fireflies (lighter integration) |
| 3 | Which meeting on the calendar is the weekly CSM↔CEO/CSM-Head sync? Title pattern + attendees so we can filter? | Need a fixed title prefix, e.g. "CSM Weekly" |
| 4 | Snapshot storage — repo branch or S3? | Repo branch |
| 5 | Cron timezone? | 09:00 IST |
| 6 | Anthropic billing — use existing API key or new? | Existing `zia-agent` key |
| 7 | Hosting target for the dashboard — Vercel or self-host? | Vercel, free tier |
| 8 | Who reviews / approves the Slack draft before posting? Auto-post, or human approval each week? | Auto-post v1; add approval step in v2 |
| 9 | Targets editable in UI or stay hardcoded? | Hardcoded |
| 10 | Should the exec-summary tile compare WoW or also vs 4-week trend? | WoW only in v1 |

---

## 10. Roadmap

ISO weeks. Today is W22 (Wed 2026-05-27). One column per week, owner column for accountability once known.

| Phase | Week | Deliverable | Verifiable when |
|---|---|---|---|
| 0 — Lock plan | W22 | This BRD + business-logic doc signed off; open decisions answered | Decisions in `§9` resolved |
| 1 — Snapshot pipeline | W23 | `snapshot.py` script that runs on cron, writes JSON | First successful Wednesday capture |
| 2 — Exec summary on dashboard | W24 | Top strip in Next.js app showing 4 WoW KPI cards | Visual diff on a screenshot |
| 3 — Weekly Slack digest | W25 | LLM-drafted message auto-posts to `#post-sales-help` | First weekly post appears |
| 4 — Transcript integration | W26 | Context layer includes Fireflies/Gong meeting summary | Context JSON shows transcript field |
| 5 — Claude chat (v2) | W28-W30 | Sidebar chat over all 3 layers with prompt caching | First end-to-end Q&A works |

Total to v1 (phases 0-4): **5 weeks** assuming I'm building it. Faster if engineering picks up phases 1-2.

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Sheet schema changes break the snapshot job | Medium | Capture `schema_fingerprint`; alert to Slack on mismatch |
| Anthropic prompt caching not hit → cost balloons | Low | Verify cache reads in first week's invoice; cap monthly spend |
| Fireflies/Gong doesn't have the right meeting | Medium | Manual transcript upload fallback for v1 |
| Slack post drafts are low-quality / hallucinate | Medium | First 2 weeks require human review before posting |
| GH Actions cron is unreliable | Low | Add a "missed snapshot" auto-recovery on next dashboard load |
| LLM context grows past the cache TTL (5 min) on chat (v2) | Medium | Pre-warm cache on every dashboard load |

---

## 12. Success metrics (90 days post-launch)

| Metric | Target |
|---|---|
| Weekly snapshot success rate | ≥ 99% |
| CSMs opening the dashboard / week | ≥ 4 (all of them at least once) |
| Slack digest read rate | ≥ 80% (Slack analytics) |
| LLM cost / month | < $20 |
| Time from sheet update → dashboard reflect | ≤ 10 min |
| Time from snapshot → Slack post | ≤ 60 sec |
| Decisions referencing a snapshot in 1:1s | ≥ 1 per CSM per month |

---

## Appendix A — Sample weekly Slack message (LLM target)

```
:bar_chart: CSM Weekly — W22 (May 27)

GRR moved 89.2% → 90.4% (+1.2 pts) ↑
NRR steady at 99.5%
At-risk ARR fell by $42K — High-Risk Renewal cleared on Globex.

What changed:
  • 2 new Closed-Won renewals (Bhargav, Janhvi): +$184K
  • 1 opp moved Forecast → Commit: Anvilcorp Q3 expansion ($55K)
  • 1 opp newly tagged Expected Churn: Hyperion Q3 ($8K)

Where to focus:
  • Joe: $93K of Q2 renewals still in Pipeline — push to Commit by Friday.
  • Aastha: %GRR Gap widened 3 pts this week — Globex slipped from Best Case to Pipeline.
  • Group-wide: Renewal Remaining sits at $3.8M; only $544K Closed-Won so far in CY2026.

:link: Dashboard: https://csm.zuddl.internal
:speech_balloon: Discuss in :thread:
```
