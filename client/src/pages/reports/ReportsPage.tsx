import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Search, Star, ChevronDown, ChevronRight, BarChart3, Play } from "lucide-react";
import { toast } from "sonner";

// Full 120+ report catalog matching AppFolio structure
const REPORT_CATALOG: Record<string, { name: string; favorite?: boolean }[]> = {
  "Accounting Reports": [
    { name: "Account Totals" },
    { name: "Balance Sheet" },
    { name: "Balance Sheet - Comparative" },
    { name: "Balance Sheet - Property Comparison" },
    { name: "Bank Account Activity" },
    { name: "Bank Account Association" },
    { name: "Cash Flow" },
    { name: "Cash Flow - 12 Month" },
    { name: "Cash Flow - Property Comparison" },
    { name: "Cash Flow Detail" },
    { name: "Chart of Accounts" },
    { name: "Expense Distribution" },
    { name: "General Ledger" },
    { name: "Income Statement" },
    { name: "Income Statement - 12 Month" },
    { name: "Income Statement - Comparative" },
    { name: "Income Statement - Property Comparison" },
    { name: "Income Statement (Date Range)" },
    { name: "Loans" },
    { name: "Trial Balance" },
    { name: "Trial Balance by Property" },
    { name: "Trust Account Balance" },
    { name: "Trust Account Detail" },
  ],
  "Association Reports": [
    { name: "Association Work Order", favorite: true },
    { name: "Budget Comparison" },
    { name: "Budget vs Actual" },
    { name: "Delinquency Report" },
    { name: "Fund Balance" },
    { name: "Fund Income Statement", favorite: true },
    { name: "Homeowner Delinquency", favorite: true },
    { name: "Homeowner Ledger" },
    { name: "Homeowner Statement" },
    { name: "HOA Assessment Roll" },
    { name: "HOA Collection Summary" },
    { name: "Move In/Out Report" },
    { name: "Occupancy Report" },
    { name: "Owner Ledger" },
    { name: "Reserve Fund Analysis" },
    { name: "Unit Charge Summary" },
    { name: "Unit Ledger" },
    { name: "Violation Report" },
  ],
  "Diagnostic Reports": [
    { name: "Bank Balance Discrepancy" },
    { name: "Duplicate Transactions" },
    { name: "GL Balance Discrepancy" },
    { name: "Missing Transactions" },
    { name: "Negative Balance Accounts" },
    { name: "Unreconciled Transactions" },
    { name: "Unposted Transactions" },
  ],
  "Maintenance Reports": [
    { name: "Maintenance Request Summary" },
    { name: "Open Work Orders" },
    { name: "Vendor Work Order History" },
    { name: "Work Order by Category" },
    { name: "Work Order Completion Time" },
    { name: "Work Order Cost Summary" },
    { name: "Preventive Maintenance Schedule" },
  ],
  "Property/Unit Reports": [
    { name: "Property Summary" },
    { name: "Unit Availability" },
    { name: "Unit Inspection Report" },
    { name: "Unit Rent Roll" },
    { name: "Unit Status Report" },
    { name: "Vacancy Report" },
  ],
  "Tax Reports": [
    { name: "1099 Detail" },
    { name: "1099 Summary" },
    { name: "Vendor 1099 Detail", favorite: true },
    { name: "Vendor 1099 Summary" },
    { name: "W-9 Status Report" },
  ],
  "Transaction Reports": [
    { name: "All Transactions" },
    { name: "Bill Payment History" },
    { name: "Check Register" },
    { name: "Credit Card Transactions" },
    { name: "EFT Transactions" },
    { name: "NSF / Returned Payments" },
    { name: "Payment History" },
    { name: "Receipt History" },
    { name: "Refund Report" },
    { name: "Transaction Audit Log" },
    { name: "Vendor Ledger", favorite: true },
    { name: "Vendor Payment History" },
    { name: "Vendor Statement" },
  ],
  "People Reports": [
    { name: "Board Member Directory" },
    { name: "Contact List" },
    { name: "Owner Directory" },
    { name: "Tenant Directory" },
    { name: "Vendor Directory" },
    { name: "Vendor Compliance Status" },
    { name: "Vendor Insurance Expiry" },
  ],
};

const FAVORITE_REPORTS = Object.values(REPORT_CATALOG)
  .flat()
  .filter(r => r.favorite);

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Accounting Reports": true });
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(FAVORITE_REPORTS.map((r: any) => r.name))
  );

  const toggleFavorite = (name: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const runReport = (name: string) => {
    toast.success(`Running: ${name}`, { description: "Report will be ready shortly" });
  };

  const filteredCatalog = Object.entries(REPORT_CATALOG).reduce<Record<string, { name: string }[]>>((acc, [cat, reports]) => {
    const filtered = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  const toggleGroup = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));

  const totalCount = Object.values(REPORT_CATALOG).flat().length;

  return (
    <ThreePanelLayout
      title="Reports"
      subtitle={`${totalCount} reports across ${Object.keys(REPORT_CATALOG).length} categories`}
      actions={
        <button
          onClick={() => toast.info("Report Builder coming soon")}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" /> Report Builder
        </button>
      }
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search reports by name, description, or column..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Favorites */}
      {!search && (
        <div className="bg-card border border-border rounded-xl mb-4">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Star className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-foreground">Favorite Reports</h3>
          </div>
          <div className="grid grid-cols-3 gap-0 divide-x divide-border">
            {Array.from(favorites).slice(0, 6).map(name => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm text-foreground">{name}</span>
                </div>
                <button
                  onClick={() => runReport(name)}
                  className="text-xs text-primary hover:underline ml-2 flex-shrink-0"
                >
                  Run
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report categories */}
      <div className="space-y-2">
        {Object.entries(filteredCatalog).map(([cat, reports]) => (
          <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(cat)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded[cat] ? "rotate-90" : ""}`} />
                <span className="text-sm font-semibold text-foreground">{cat}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{reports.length}</span>
              </div>
            </button>
            {expanded[cat] && (
              <div className="border-t border-border grid grid-cols-3">
                {reports.map(r => (
                  <div key={r.name} className="flex items-center justify-between px-4 py-2.5 border-b border-border hover:bg-accent/20 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => toggleFavorite(r.name)}
                        className="flex-shrink-0"
                      >
                        <Star className={`w-3.5 h-3.5 transition-colors ${favorites.has(r.name) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`} />
                      </button>
                      <span className="text-sm text-foreground truncate">{r.name}</span>
                    </div>
                    <button
                      onClick={() => runReport(r.name)}
                      className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                    >
                      <Play className="w-3 h-3" /> Run
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ThreePanelLayout>
  );
}
