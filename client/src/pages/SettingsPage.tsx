import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { User, Bell, Shield, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <ThreePanelLayout title="Settings" subtitle="Account and system preferences">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name</label>
              <div className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground">{user?.name ?? "—"}</div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <div className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground">{user?.email ?? "—"}</div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <div className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground capitalize">{(user as any)?.role?.replace(/_/g, " ") ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-3">
            {["New bill approvals", "Delinquency alerts", "Maintenance updates", "Report delivery"].map(n => (
              <label key={n} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-foreground">{n}</span>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Security</h3>
          </div>
          <p className="text-sm text-muted-foreground">Authentication is managed through Manus OAuth. No password management required.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Company</h3>
          </div>
          <p className="text-sm text-muted-foreground">Portier369</p>
          <p className="text-xs text-muted-foreground mt-1">stellarpropertygrp.appfolio.com</p>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
