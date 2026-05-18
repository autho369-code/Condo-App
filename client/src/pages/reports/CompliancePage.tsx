import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function CompliancePage() {
  const { data: vendors, isLoading } = trpc.vendors.list.useQuery({});

  const expiring = (vendors ?? []).filter(v => {
    const insExpDays = v.insuranceExpiry ? differenceInDays(new Date(v.insuranceExpiry), new Date()) : null;
    const licExpDays = v.licenseExpiry ? differenceInDays(new Date(v.licenseExpiry), new Date()) : null;
    return !v.w9OnFile || (insExpDays !== null && insExpDays < 30) || (licExpDays !== null && licExpDays < 30);
  });

  return (
    <ThreePanelLayout title="Compliance" subtitle="Vendor insurance, license, and W-9 status">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-green">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center mb-3">
            <CheckCircle className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{(vendors ?? []).length - expiring.length}</div>
          <div className="text-sm text-muted-foreground">Compliant Vendors</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-orange">
          <div className="w-9 h-9 rounded-lg bg-orange-400/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{expiring.length}</div>
          <div className="text-sm text-muted-foreground">Expiring / Missing</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-blue">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center mb-3">
            <Shield className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{vendors?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Total Vendors</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Vendor Compliance Status</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendor</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Insurance Expiry</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">License Expiry</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">W-9</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : vendors && vendors.length > 0 ? vendors.map(v => {
              const insExpiry = v.insuranceExpiry ? differenceInDays(new Date(v.insuranceExpiry), new Date()) : null;
              const licExpiry = v.licenseExpiry ? differenceInDays(new Date(v.licenseExpiry), new Date()) : null;
              const isCompliant = (insExpiry === null || insExpiry > 30) && (licExpiry === null || licExpiry > 30) && v.w9OnFile;

              return (
                <tr key={v.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{v.companyName}</td>
                  <td className="px-4 py-3 text-sm">
                    {v.insuranceExpiry ? (
                      <span className={insExpiry !== null && insExpiry < 30 ? "text-red-400" : "text-foreground"}>
                        {format(new Date(v.insuranceExpiry), "MM/dd/yyyy")}
                        {insExpiry !== null && insExpiry < 30 && ` (${insExpiry}d)`}
                      </span>
                    ) : <span className="text-red-400">Missing</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {v.licenseExpiry ? (
                      <span className={licExpiry !== null && licExpiry < 30 ? "text-red-400" : "text-foreground"}>
                        {format(new Date(v.licenseExpiry), "MM/dd/yyyy")}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {v.w9OnFile
                      ? <span className="text-green-400">On File</span>
                      : <span className="text-red-400">Missing</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isCompliant ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                      {isCompliant ? "Compliant" : "Action Required"}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No vendors found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
