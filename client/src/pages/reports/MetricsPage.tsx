import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, Wrench } from "lucide-react";

export default function MetricsPage() {
  return (
    <ThreePanelLayout title="Metrics" subtitle="Portfolio-wide performance metrics">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Collection Rate", value: "97.2%", trend: "+1.1%", up: true, icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10" },
          { label: "Avg Days to Pay", value: "12.4", trend: "-2.1 days", up: true, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Open Work Orders", value: "23", trend: "+3", up: false, icon: Wrench, color: "text-orange-400", bg: "bg-orange-400/10" },
          { label: "Delinquency Rate", value: "2.8%", trend: "-0.3%", up: true, icon: TrendingDown, color: "text-purple-400", bg: "bg-purple-400/10" },
          { label: "Active Owners", value: "412", trend: "+8", up: true, icon: Users, color: "text-cyan-400", bg: "bg-cyan-400/10" },
          { label: "YTD Income", value: "$1.24M", trend: "+12%", up: true, icon: BarChart3, color: "text-yellow-400", bg: "bg-yellow-400/10" },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4.5 h-4.5 ${m.color}`} />
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.up ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                {m.trend}
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground">{m.value}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Detailed charts and trend analysis coming soon</p>
      </div>
    </ThreePanelLayout>
  );
}
