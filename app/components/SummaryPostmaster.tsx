"use client";

import { useEffect } from "react";

// Posts the current top-line summary numbers (Projected ARR, Renewal Base,
// row count) plus the data fetch timestamp to the parent window so the
// revenue-os shell can render its always-sticky combined navigation +
// summary bar in sync with the latest filter selection.
export function SummaryPostmaster({
  projectedArr,
  renewalBase,
  rowCount,
  fetchedAt,
}: {
  projectedArr: number;
  renewalBase: number;
  rowCount: number;
  fetchedAt: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.parent?.postMessage(
        {
          type: "csm-bob:summary",
          projectedArr,
          renewalBase,
          rowCount,
          fetchedAt,
        },
        "*",
      );
    } catch {
      /* cross-origin denied — silently ignore */
    }
  }, [projectedArr, renewalBase, rowCount, fetchedAt]);
  return null;
}
