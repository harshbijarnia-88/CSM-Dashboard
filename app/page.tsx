import { Dashboard } from "./components/Dashboard";
import { fetchReport } from "@/lib/data/fetchReport";

export const revalidate = 600;

export default async function Page() {
  try {
    const { rows, fetchedAt } = await fetchReport();
    // Expansion donut now reads from the same main report sheet, narrowed
    // to Type = "Expansion". The separate expansion-only sheet is no longer
    // fetched — keeps every panel reading from one source of truth.
    const expansionRows = rows.filter(
      (r) => String(r["Type"] ?? "").trim() === "Expansion",
    );
    return (
      <Dashboard
        rows={rows}
        fetchedAt={fetchedAt}
        expansionRows={expansionRows}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <div className="rounded-md border border-danger/30 bg-red-50 p-4 text-sm text-danger">
          <div className="font-medium">Failed to load report.</div>
          <div className="mt-1 text-danger/80">{message}</div>
        </div>
      </div>
    );
  }
}
