import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { FileText, DollarSign, Wrench, Users, BarChart3 } from "lucide-react";

const ACTIVITY_ICONS: Record<string, any> = {
  bill: DollarSign,
  receipt: DollarSign,
  maintenance: Wrench,
  report: BarChart3,
  user: Users,
  default: FileText,
};

export default function ActivityPage() {
  const { data: activities, isLoading } = trpc.activity.list.useQuery({ limit: 50 });

  return (
    <ThreePanelLayout title="Activity" subtitle="Recent actions across your portfolio">
      <div className="space-y-1">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-2/3 mb-1" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))
        ) : activities && activities.length > 0 ? activities.map(a => {
          const Icon = ACTIVITY_ICONS[a.activityType] ?? ACTIVITY_ICONS.default;
          return (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/20 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.userId && <span className="font-medium">User #{a.userId} · </span>}
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-16 text-muted-foreground text-sm">No recent activity</div>
        )}
      </div>
    </ThreePanelLayout>
  );
}
