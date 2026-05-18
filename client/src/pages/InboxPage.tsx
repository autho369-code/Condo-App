import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { Bell, CheckCircle } from "lucide-react";

export default function InboxPage() {
  return (
    <ThreePanelLayout title="Inbox" subtitle="Notifications and messages">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Bell className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">All caught up</h3>
        <p className="text-sm text-muted-foreground">No new notifications at this time.</p>
      </div>
    </ThreePanelLayout>
  );
}
