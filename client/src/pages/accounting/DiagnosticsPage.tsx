import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle, RefreshCw, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export default function DiagnosticsPage() {
  const { data: flags, isLoading, refetch } = trpc.accounting.diagnostics.useQuery();

  const grouped: Record<string, typeof flags> = {};
  (flags ?? []).forEach(f => {
    if (!grouped[f.severity]) grouped[f.severity] = [];
    grouped[f.severity]!.push(f);
  });

  const SEVERITY_STYLES: Record<string, { badge: string; icon: string }> = {
    critical: { badge: "status-void", icon: "" },
    high: { badge: "status-pending", icon: "" },
    medium: { badge: "status-pending", icon: "" },
    low: { badge: "status-posted", icon: "" },
  };

  return (
    <ThreePanelLayout
      title="Financial Diagnostics"
      subtitle="System health checks and anomaly detection"
      actions={
        <button
          onClick={() => { refetch(); toast.info("Running diagnostics..."); }}
          className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Run Diagnostics
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : flags && flags.length > 0 ? (
        <div className="space-y-4">
          {SEVERITY_ORDER.filter(s => grouped[s]?.length).map(severity => (
            <div key={severity}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
                {severity} ({grouped[severity]?.length})
              </h3>
              <div className="space-y-2">
                {grouped[severity]?.map(flag => (
                  <div key={flag.id} className={`bg-card border rounded-xl p-4 ${SEVERITY_STYLES[severity]?.badge}`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${SEVERITY_STYLES[severity]?.icon}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground">{flag.flagType}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(flag.detectedAt), { addSuffix: true })}
                          </span>
                        </div>
                        {flag.description && (
                          <p className="text-sm text-muted-foreground mb-2">{flag.description}</p>
                        )}
                        {flag.manusResolutionDraft && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Wrench className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-primary">AI Resolution Draft</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{flag.manusResolutionDraft}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_STYLES[severity]?.badge}`}>
                            {flag.resolvedAt ? "resolved" : "open"}
                          </span>
                          {flag.propertyId && (
                            <span className="text-xs text-muted-foreground">Property #{flag.propertyId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="w-12 h-12 text-[#2d4a2d] mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">All Systems Healthy</h3>
          <p className="text-sm text-muted-foreground">No diagnostic flags detected across your portfolio.</p>
        </div>
      )}
    </ThreePanelLayout>
  );
}
