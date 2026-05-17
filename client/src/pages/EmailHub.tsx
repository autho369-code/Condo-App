import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Mail, Plus, Sparkles, CheckCheck, Search, RefreshCw,
  Link2, Link2Off, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Gmail and Outlook brand SVG icons
function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#fff" stroke="#e0e0e0" strokeWidth="0.5"/>
      <path d="M22 6l-10 7L2 6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
      <path d="M2 6l10 7 10-7" fill="none"/>
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="13" height="16" rx="2" fill="#0078D4"/>
      <rect x="11" y="6" width="11" height="12" rx="1" fill="#50A0E0"/>
      <path d="M11 6h11l-5.5 5L11 6z" fill="#0078D4"/>
      <circle cx="7.5" cy="12" r="3" fill="white"/>
    </svg>
  );
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  gmail: { label: "Gmail", color: "bg-red-50 text-red-600 border-red-200" },
  outlook: { label: "Outlook", color: "bg-blue-50 text-blue-600 border-blue-200" },
  manual: { label: "Manual", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

export default function EmailHub() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", fromAddress: "", toAddresses: "", fullBody: "" });
  const [draftOpen, setDraftOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [location] = useLocation();

  const utils = trpc.useUtils();
  const { data: emails, isLoading } = trpc.email.list.useQuery();
  const { data: connections, isLoading: connectionsLoading } = trpc.email.listConnections.useQuery();

  // Handle redirect back from OAuth with success/error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected === "gmail" ? "Gmail" : "Outlook"} account connected successfully!`);
      utils.email.listConnections.invalidate();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (error) {
      const msg = error.includes("cancelled") ? "Connection was cancelled." : "Failed to connect account. Please try again.";
      toast.error(msg);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const addEmail = trpc.email.add.useMutation({
    onSuccess: () => {
      toast.success("Email logged.");
      utils.email.list.invalidate();
      setOpen(false);
      setForm({ subject: "", fromAddress: "", toAddresses: "", fullBody: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const markRead = trpc.email.markRead.useMutation({
    onSuccess: () => utils.email.list.invalidate(),
  });

  const draftReply = trpc.email.draftReply.useMutation({
    onSuccess: (data) => {
      setDraft(data.draft);
      toast.success("AI draft ready.");
    },
    onError: () => toast.error("Could not generate draft."),
  });

  const syncEmails = trpc.email.syncEmails.useMutation({
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Synced ${data.synced} new email${data.synced !== 1 ? "s" : ""}.`);
        utils.email.list.invalidate();
        utils.email.listConnections.invalidate();
      }
      setSyncingId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setSyncingId(null);
    },
  });

  const disconnectAccount = trpc.email.disconnectAccount.useMutation({
    onSuccess: () => {
      toast.success("Account disconnected.");
      utils.email.listConnections.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleConnect = (provider: "gmail" | "outlook") => {
    const origin = window.location.origin;
    window.location.href = `/api/email/${provider}/connect?origin=${encodeURIComponent(origin)}`;
  };

  const handleSync = (connectionId: number) => {
    setSyncingId(connectionId);
    syncEmails.mutate({ connectionId });
  };

  const filtered = (emails ?? []).filter(e =>
    !search ||
    (e.subject ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.fromAddress ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const unread = filtered.filter(e => !e.isRead).length;
  const gmailConnected = (connections ?? []).some(c => c.provider === "gmail");
  const outlookConnected = (connections ?? []).some(c => c.provider === "outlook");

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Email Hub</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {unread > 0
              ? <span className="text-olive font-medium">{unread} unread</span>
              : "All caught up"
            } · {filtered.length} total threads
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90">
              <Plus className="w-4 h-4 mr-2" />Log Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Log Email Thread</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Subject</Label><Input placeholder="Re: Roof leak in unit 12A" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div><Label>From</Label><Input placeholder="resident@example.com" value={form.fromAddress} onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))} /></div>
              <div><Label>To</Label><Input placeholder="manager@yourcompany.com" value={form.toAddresses} onChange={e => setForm(f => ({ ...f, toAddresses: e.target.value }))} /></div>
              <div><Label>Body</Label><Textarea placeholder="Email content..." value={form.fullBody} onChange={e => setForm(f => ({ ...f, fullBody: e.target.value }))} rows={4} /></div>
              <Button
                className="w-full bg-olive text-cream"
                onClick={() => addEmail.mutate({ ...form, source: "manual", bodyPreview: form.fullBody.slice(0, 200) })}
                disabled={addEmail.isPending}
              >
                {addEmail.isPending ? "Logging..." : "Log Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Accounts Panel */}
      <Card className="mb-6 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-charcoal flex items-center gap-2">
            <Link2 className="w-4 h-4 text-olive" />
            Connected Inboxes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gmail */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
              <div className="flex items-center gap-3">
                <GmailIcon className="w-8 h-8" />
                <div>
                  <p className="text-sm font-semibold text-charcoal">Gmail</p>
                  {gmailConnected ? (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {(connections ?? []).find(c => c.provider === "gmail")?.accountEmail ?? "Connected"}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {gmailConnected ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-olive/30 text-olive hover:bg-olive/10"
                      onClick={() => {
                        const conn = (connections ?? []).find(c => c.provider === "gmail");
                        if (conn) handleSync(conn.id);
                      }}
                      disabled={syncingId !== null}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncingId !== null ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const conn = (connections ?? []).find(c => c.provider === "gmail");
                        if (conn) disconnectAccount.mutate({ connectionId: conn.id });
                      }}
                    >
                      <Link2Off className="w-3.5 h-3.5 mr-1" />Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs bg-olive text-cream hover:bg-olive/90"
                    onClick={() => handleConnect("gmail")}
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>

            {/* Outlook */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
              <div className="flex items-center gap-3">
                <OutlookIcon className="w-8 h-8" />
                <div>
                  <p className="text-sm font-semibold text-charcoal">Outlook</p>
                  {outlookConnected ? (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {(connections ?? []).find(c => c.provider === "outlook")?.accountEmail ?? "Connected"}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {outlookConnected ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={() => {
                        const conn = (connections ?? []).find(c => c.provider === "outlook");
                        if (conn) handleSync(conn.id);
                      }}
                      disabled={syncingId !== null}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncingId !== null ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const conn = (connections ?? []).find(c => c.provider === "outlook");
                        if (conn) disconnectAccount.mutate({ connectionId: conn.id });
                      }}
                    >
                      <Link2Off className="w-3.5 h-3.5 mr-1" />Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => handleConnect("outlook")}
                  >
                    Connect Outlook
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Last sync info */}
          {(connections ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {(connections ?? []).map(conn => (
                conn.lastSyncedAt && (
                  <div key={conn.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {conn.provider === "gmail" ? "Gmail" : "Outlook"} last synced: {new Date(conn.lastSyncedAt).toLocaleString()}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Setup notice if neither is configured */}
          {!gmailConnected && !outlookConnected && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                To enable Gmail or Outlook sync, add your OAuth credentials in <strong>Settings → Secrets</strong> (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET), then click Connect above.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by subject or sender..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Email list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No emails yet</p>
          <p className="text-sm mt-1">Connect Gmail or Outlook above to sync your inbox, or log an email manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => {
            const sourceInfo = SOURCE_LABELS[e.source ?? "manual"] ?? SOURCE_LABELS.manual;
            return (
              <Card key={e.id} className={`hover:shadow-sm transition-shadow ${!e.isRead ? "border-olive/40 bg-olive/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!e.isRead && <div className="w-2 h-2 rounded-full bg-olive flex-shrink-0" />}
                        <p className={`text-sm truncate ${!e.isRead ? "font-semibold text-charcoal" : "font-medium text-charcoal"}`}>
                          {e.subject ?? "(No subject)"}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${sourceInfo.color}`}
                        >
                          {sourceInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {e.fromAddress ?? "Unknown sender"} · {new Date(e.receivedAt).toLocaleDateString()}
                      </p>
                      {e.bodyPreview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.bodyPreview}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!e.isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => markRead.mutate({ emailId: e.id })}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1" />Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs border-olive/30 text-olive hover:bg-olive/10"
                        onClick={() => {
                          setDraftOpen(e.id);
                          draftReply.mutate({ subject: e.subject ?? "", body: e.fullBody ?? e.bodyPreview ?? "" });
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />AI Reply
                      </Button>
                    </div>
                  </div>

                  {/* AI Draft panel */}
                  {draftOpen === e.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {draftReply.isPending ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="w-4 h-4 animate-pulse text-olive" />Generating draft...
                        </div>
                      ) : draft ? (
                        <div>
                          <p className="text-xs font-semibold text-olive mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />AI Draft Reply
                          </p>
                          <Textarea value={draft} onChange={ev => setDraft(ev.target.value)} rows={4} className="text-sm" />
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              className="bg-olive text-cream text-xs"
                              onClick={() => { navigator.clipboard.writeText(draft); toast.success("Copied to clipboard."); }}
                            >
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => { setDraftOpen(null); setDraft(""); }}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
