import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Plus, Calendar, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ScheduledReportsPage() {
  const { data: scheduled, isLoading } = trpc.reports.scheduled.useQuery();

  return (
    <ThreePanelLayout
      title="Scheduled Reports"
      subtitle="Automate report delivery on a recurring schedule"
      actions={
        <button
          onClick={() => toast.info("Schedule builder coming soon")}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </button>
      }
    >
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frequency</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipients</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Run</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Run</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : scheduled && scheduled.length > 0 ? scheduled.map(s => (
              <tr key={s.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{s.reportName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{s.frequency}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{s.recipients?.length ?? 0} recipients</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {"—"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {s.lastRun ? format(new Date(s.lastRun), "MM/dd/yyyy") : "Never"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? "status-approved" : "bg-muted text-muted-foreground"}`}>
                    {s.isActive ? "Active" : "Paused"}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No scheduled reports configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
