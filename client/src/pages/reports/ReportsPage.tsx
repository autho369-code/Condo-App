import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Search, Star, ChevronRight, BarChart3, Play, X,
  Download, Loader2, Calendar, AlertCircle, FileText
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
}

interface ReportInfo {
  id: string;
  name: string;
}

// ─── Report Viewer Modal ───────────────────────────────────────────────────────
function ReportViewer({
  report,
  result,
  isLoading,
  onClose,
}: {
  report: ReportInfo | null;
  result: ReportResult | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const exportCsv = () => {
    if (!result) return;
    const header = result.columns.join(",");
    const rows = result.rows.map(row =>
      result.columns.map(col => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report?.id ?? "report"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <Dialog open={!!report} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-semibold">{report?.name}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {result && !isLoading && (
                <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Generating report...</p>
            </div>
          )}

          {!isLoading && result && (
            <>
              {/* Summary cards */}
              {result.summary && Object.keys(result.summary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {Object.entries(result.summary).map(([key, value]) => (
                    <div key={key} className="bg-muted/40 rounded-lg px-4 py-3 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{key}</p>
                      <p className="text-base font-semibold text-foreground">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Data table */}
              {result.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">No data found for the selected period.</p>
                  <p className="text-xs">Try adjusting the date range or check if data exists.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border">
                          {result.columns.map(col => (
                            <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-accent/10 transition-colors">
                            {result.columns.map(col => (
                              <td key={col} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                                {String(row[col] ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
                    {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Accounting Reports": true });
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(["Fund Income Statement", "Homeowner Delinquency", "Vendor 1099 Detail", "Vendor Ledger", "Association Work Order"])
  );
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeReport, setActiveReport] = useState<ReportInfo | null>(null);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: catalog } = trpc.reports.catalog.useQuery();
  const runMutation = trpc.reports.run.useMutation();

  const toggleFavorite = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const runReport = async (report: ReportInfo) => {
    setActiveReport(report);
    setReportResult(null);
    setIsRunning(true);
    try {
      const result = await runMutation.mutateAsync({
        reportId: report.id,
        startDate,
        endDate,
      });
      setReportResult(result as ReportResult);
    } catch (err: any) {
      toast.error(`Failed to run report: ${err.message ?? "Unknown error"}`);
      setActiveReport(null);
    } finally {
      setIsRunning(false);
    }
  };

  const catalogData = catalog ?? [];

  const filteredCatalog = catalogData.map(cat => ({
    ...cat,
    reports: cat.reports.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.reports.length > 0);

  const allReports = catalogData.flatMap(c => c.reports);
  const favoriteReports = allReports.filter(r => favorites.has(r.name));
  const totalCount = allReports.length;

  const toggleGroup = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <ThreePanelLayout
      title="Reports"
      subtitle={`${totalCount} reports across ${catalogData.length} categories`}
      actions={
        <button
          onClick={() => toast.info("Report Builder coming soon")}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" /> Report Builder
        </button>
      }
    >
      {/* Date Range */}
      <div className="flex items-center gap-3 mb-4 bg-card border border-border rounded-xl px-4 py-3">
        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">Date Range:</span>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Badge variant="secondary" className="ml-auto text-xs">Applied to all reports</Badge>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Favorites */}
      {!search && favoriteReports.length > 0 && (
        <div className="bg-card border border-border rounded-xl mb-4">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Star className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-foreground">Favorite Reports</h3>
          </div>
          <div className="grid grid-cols-3 gap-0 divide-x divide-border">
            {favoriteReports.slice(0, 6).map(r => (
              <div key={r.name} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{r.name}</span>
                </div>
                <button
                  onClick={() => runReport(r)}
                  className="text-xs text-primary hover:underline ml-2 flex-shrink-0 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> Run
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report categories */}
      <div className="space-y-2">
        {filteredCatalog.map(({ category, reports }) => (
          <div key={category} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(category)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded[category] ? "rotate-90" : ""}`} />
                <span className="text-sm font-semibold text-foreground">{category}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{reports.length}</span>
              </div>
            </button>
            {expanded[category] && (
              <div className="border-t border-border grid grid-cols-3">
                {reports.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-border hover:bg-accent/20 transition-colors group cursor-pointer"
                    onClick={() => runReport(r)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={e => toggleFavorite(r.name, e)}
                        className="flex-shrink-0"
                      >
                        <Star className={`w-3.5 h-3.5 transition-colors ${favorites.has(r.name) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`} />
                      </button>
                      <span className="text-sm text-foreground truncate">{r.name}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                      <Play className="w-3 h-3" /> Run
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Report Viewer Modal */}
      <ReportViewer
        report={activeReport}
        result={reportResult}
        isLoading={isRunning}
        onClose={() => { setActiveReport(null); setReportResult(null); }}
      />
    </ThreePanelLayout>
  );
}
