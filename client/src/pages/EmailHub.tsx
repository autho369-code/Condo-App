import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mail, Plus, Sparkles, CheckCheck, Search, RefreshCw,
  Link2, Link2Off, AlertCircle, CheckCircle2, Clock,
  Building2, Zap, AlertTriangle, Info, ChevronDown, ChevronUp,
  Ticket, ExternalLink, CheckCircle
} from "lucide-react";
import { toast } from "sonner";

// ─── Brand Icons ──────────────────────────────────────────────────────────────

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#fff" stroke="#e0e0e0" strokeWidth="0.5"/>
      <path d="M22 6l-10 7L2 6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
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

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; dot: string }> = {
  critical: {
    label: "Critical",
    color: "bg-red-100 text-red-700 border-red-300",
    icon: <Zap className="w-3 h-3" />,
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    icon: <AlertTriangle className="w-3 h-3" />,
    dot: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Info className="w-3 h-3" />,
    dot: "bg-amber-400",
  },
  low: {
    label: "Low",
    color: "bg-stone-100 text-stone-500 border-stone-200",
    icon: <Info className="w-3 h-3" />,
    dot: "bg-stone-300",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  maintenance_request: "Maintenance",
  billing_payment: "Billing",
  noise_complaint: "Noise",
  amenity_booking: "Amenity",
  vendor_communication: "Vendor",
  board_matter: "Board",
  emergency: "Emergency",
  general_inquiry: "Inquiry",
  lease_ownership: "Ownership",
  other: "Other",
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  gmail: { label: "Gmail", color: "bg-red-50 text-red-600 border-red-200" },
  outlook: { label: "Outlook", color: "bg-blue-50 text-blue-600 border-blue-200" },
  manual: { label: "Manual", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

type FilterTab = "all" | "critical" | "high" | "unassigned";

export default function EmailHub() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", fromAddress: "", toAddresses: "", fullBody: "" });
  const [draftOpen, setDraftOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [expandedReason, setExpandedReason] = useState<number | null>(null);
  // Convert to ticket dialog state
  const [convertDialogEmail, setConvertDialogEmail] = useState<null | {
    id: number;
    subject: string;
    fromAddress: string | null;
    bodyPreview: string | null;
    aiUrgency: string | null;
    aiCategory: string | null;
    aiMatchedPropertyId: number | null;
    convertedToTicketId: number | null;
  }>(null);
  const [ticketForm, setTicketForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    propertyId: "",
    unitNumber: "",
    category: "maintenance" as string,
  });

  const utils = trpc.useUtils();
  const { data: emails, isLoading } = trpc.email.list.useQuery();
  const { data: connections } = trpc.email.listConnections.useQuery();
  const { data: properties } = trpc.company.properties.useQuery();

  // Handle OAuth redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected === "gmail" ? "Gmail" : "Outlook"} account connected successfully!`);
      utils.email.listConnections.invalidate();
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (error) {
      toast.error(error.includes("cancelled") ? "Connection was cancelled." : "Failed to connect account.");
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
    onSuccess: (data) => { setDraft(data.draft); toast.success("AI draft ready."); },
    onError: () => toast.error("Could not generate draft."),
  });

  const syncEmails = trpc.email.syncEmails.useMutation({
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); }
      else { toast.success(`Synced ${data.synced} new email${data.synced !== 1 ? "s" : ""}.`); utils.email.list.invalidate(); utils.email.listConnections.invalidate(); }
      setSyncingId(null);
    },
    onError: (e) => { toast.error(e.message); setSyncingId(null); },
  });

  const disconnectAccount = trpc.email.disconnectAccount.useMutation({
    onSuccess: () => { toast.success("Account disconnected."); utils.email.listConnections.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const recategorize = trpc.email.recategorize.useMutation({
    onSuccess: (result) => {
      toast.success(`Re-categorized: ${result.urgency} urgency · ${CATEGORY_LABELS[result.category] ?? result.category}`);
      utils.email.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const convertToTicket = trpc.email.convertToTicket.useMutation({
    onSuccess: (data) => {
      toast.success(`Ticket #${data.ticketId} created successfully!`, {
        action: {
          label: "View Tickets",
          onClick: () => window.location.href = "/dashboard/tickets",
        },
      });
      utils.email.list.invalidate();
      setConvertDialogEmail(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkRecategorize = trpc.email.bulkRecategorize.useMutation({
    onSuccess: (data) => {
      toast.success(`AI categorized ${data.processed} email${data.processed !== 1 ? "s" : ""}${data.errors > 0 ? ` (${data.errors} skipped)` : ""}.`);
      utils.email.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Map AI urgency → ticket priority
  const urgencyToPriority = (urgency: string | null): "low" | "medium" | "high" | "urgent" => {
    if (urgency === "critical") return "urgent";
    if (urgency === "high") return "high";
    if (urgency === "medium") return "medium";
    return "low";
  };

  // Map AI email category → ticket category
  const emailCategoryToTicketCategory = (cat: string | null): string => {
    if (!cat) return "other";
    const map: Record<string, string> = {
      maintenance_request: "maintenance",
      emergency: "emergency",
      vendor_communication: "vendor",
      board_matter: "board_matter",
      billing_payment: "other",
      noise_complaint: "common_area",
      amenity_booking: "common_area",
      lease_ownership: "unit_related",
      general_inquiry: "other",
    };
    return map[cat] ?? "other";
  };

  const openConvertDialog = (e: typeof emails extends (infer T)[] | undefined ? T : never) => {
    const ea = e as any;
    setConvertDialogEmail({
      id: ea.id,
      subject: ea.subject ?? "",
      fromAddress: ea.fromAddress ?? null,
      bodyPreview: ea.bodyPreview ?? null,
      aiUrgency: ea.aiUrgency ?? null,
      aiCategory: ea.aiCategory ?? null,
      aiMatchedPropertyId: ea.aiMatchedPropertyId ?? null,
      convertedToTicketId: ea.convertedToTicketId ?? null,
    });
    setTicketForm({
      title: ea.subject ?? "",
      description: ea.bodyPreview ? `From: ${ea.fromAddress ?? "unknown"}\n\n${ea.bodyPreview}` : "",
      priority: urgencyToPriority(ea.aiUrgency),
      propertyId: ea.aiMatchedPropertyId ? String(ea.aiMatchedPropertyId) : "",
      unitNumber: "",
      category: emailCategoryToTicketCategory(ea.aiCategory),
    });
  };

  const handleConnect = (provider: "gmail" | "outlook") => {
    window.location.href = `/api/email/${provider}/connect?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleSync = (connectionId: number) => {
    setSyncingId(connectionId);
    syncEmails.mutate({ connectionId });
  };

  // Build a property lookup map
  const propertyMap = Object.fromEntries((properties ?? []).map((p: { id: number; name: string }) => [p.id, p.name]));

  // Filter emails by tab + search
  const filtered = (emails ?? []).filter(e => {
    const matchesSearch = !search ||
      (e.subject ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.fromAddress ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "critical" ? (e as any).aiUrgency === "critical" :
      activeTab === "high" ? ((e as any).aiUrgency === "high" || (e as any).aiUrgency === "critical") :
      activeTab === "unassigned" ? !(e as any).aiCategorizedAt :
      true;

    return matchesSearch && matchesTab;
  });

  const unread = (emails ?? []).filter(e => !e.isRead).length;
  const uncategorized = (emails ?? []).filter(e => !(e as any).aiCategorizedAt).length;
  const gmailConnected = (connections ?? []).some(c => c.provider === "gmail");
  const outlookConnected = (connections ?? []).some(c => c.provider === "outlook");

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Email Hub</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {unread > 0 ? <span className="text-olive font-medium">{unread} unread · </span> : ""}
            {filtered.length} threads
            {uncategorized > 0 && (
              <span className="ml-2 text-amber-600">· {uncategorized} uncategorized</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {uncategorized > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-olive/40 text-olive hover:bg-olive/10 text-xs"
              onClick={() => bulkRecategorize.mutate()}
              disabled={bulkRecategorize.isPending}
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${bulkRecategorize.isPending ? "animate-pulse" : ""}`} />
              {bulkRecategorize.isPending ? "Categorizing..." : `AI Categorize All (${uncategorized})`}
            </Button>
          )}
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
                  ) : <p className="text-xs text-muted-foreground">Not connected</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {gmailConnected ? (
                  <>
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-olive/30 text-olive hover:bg-olive/10"
                      onClick={() => { const c = (connections ?? []).find(c => c.provider === "gmail"); if (c) handleSync(c.id); }}
                      disabled={syncingId !== null}>
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncingId !== null ? "animate-spin" : ""}`} />Sync
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => { const c = (connections ?? []).find(c => c.provider === "gmail"); if (c) disconnectAccount.mutate({ connectionId: c.id }); }}>
                      <Link2Off className="w-3.5 h-3.5 mr-1" />Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="h-8 px-3 text-xs bg-olive text-cream hover:bg-olive/90" onClick={() => handleConnect("gmail")}>
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
                  ) : <p className="text-xs text-muted-foreground">Not connected</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {outlookConnected ? (
                  <>
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={() => { const c = (connections ?? []).find(c => c.provider === "outlook"); if (c) handleSync(c.id); }}
                      disabled={syncingId !== null}>
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncingId !== null ? "animate-spin" : ""}`} />Sync
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => { const c = (connections ?? []).find(c => c.provider === "outlook"); if (c) disconnectAccount.mutate({ connectionId: c.id }); }}>
                      <Link2Off className="w-3.5 h-3.5 mr-1" />Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleConnect("outlook")}>
                    Connect Outlook
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Last sync timestamps */}
          {(connections ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {(connections ?? []).map(conn =>
                conn.lastSyncedAt ? (
                  <div key={conn.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {conn.provider === "gmail" ? "Gmail" : "Outlook"} synced: {new Date(conn.lastSyncedAt).toLocaleString()}
                  </div>
                ) : null
              )}
            </div>
          )}

          {!gmailConnected && !outlookConnected && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Add your OAuth credentials in <strong>Settings → Secrets</strong> (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET), then click Connect above.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search + Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by subject or sender..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as FilterTab)}>
          <TabsList className="h-10">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="critical" className="text-xs px-3 text-red-600 data-[state=active]:bg-red-100">
              <Zap className="w-3 h-3 mr-1" />Critical
            </TabsTrigger>
            <TabsTrigger value="high" className="text-xs px-3 text-orange-600 data-[state=active]:bg-orange-100">
              <AlertTriangle className="w-3 h-3 mr-1" />High
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs px-3">
              Unassigned
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No emails in this view</p>
          <p className="text-sm mt-1">
            {activeTab !== "all" ? "Try switching to the All tab." : "Connect Gmail or Outlook above to sync your inbox."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => {
            const emailAny = e as any;
            const sourceInfo = SOURCE_LABELS[e.source ?? "manual"] ?? SOURCE_LABELS.manual;
            const urgencyInfo = emailAny.aiUrgency ? URGENCY_CONFIG[emailAny.aiUrgency] : null;
            const categoryLabel = emailAny.aiCategory ? CATEGORY_LABELS[emailAny.aiCategory] : null;
            const matchedProperty = emailAny.aiMatchedPropertyId ? propertyMap[emailAny.aiMatchedPropertyId] : null;
            const isCategorized = !!emailAny.aiCategorizedAt;
            const isRecategorizing = recategorize.isPending && recategorize.variables?.emailId === e.id;

            return (
              <Card
                key={e.id}
                className={`hover:shadow-sm transition-shadow ${
                  emailAny.aiUrgency === "critical"
                    ? "border-red-300 bg-red-50/30"
                    : emailAny.aiUrgency === "high"
                    ? "border-orange-200 bg-orange-50/20"
                    : !e.isRead
                    ? "border-olive/40 bg-olive/5"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Subject line + badges */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!e.isRead && <div className="w-2 h-2 rounded-full bg-olive flex-shrink-0" />}
                        <p className={`text-sm truncate ${!e.isRead ? "font-semibold text-charcoal" : "font-medium text-charcoal"}`}>
                          {e.subject ?? "(No subject)"}
                        </p>

                        {/* Source badge */}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${sourceInfo.color}`}>
                          {sourceInfo.label}
                        </Badge>

                        {/* Urgency badge */}
                        {urgencyInfo && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 flex items-center gap-0.5 ${urgencyInfo.color}`}>
                            {urgencyInfo.icon}
                            {urgencyInfo.label}
                          </Badge>
                        )}

                        {/* Category badge */}
                        {categoryLabel && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-stone-50 text-stone-600 border-stone-200">
                            {categoryLabel}
                          </Badge>
                        )}
                      </div>

                      {/* Sender + date */}
                      <p className="text-xs text-muted-foreground">
                        {e.fromAddress ?? "Unknown sender"} · {new Date(e.receivedAt).toLocaleDateString()}
                      </p>

                      {/* Body preview */}
                      {e.bodyPreview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.bodyPreview}</p>
                      )}

                      {/* Property tag + AI reasoning */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {matchedProperty && (
                          <div className="flex items-center gap-1 text-xs text-olive bg-olive/10 px-2 py-0.5 rounded-full">
                            <Building2 className="w-3 h-3" />
                            {matchedProperty}
                          </div>
                        )}
                        {emailAny.aiReasoning && (
                          <button
                            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-charcoal transition-colors"
                            onClick={() => setExpandedReason(expandedReason === e.id ? null : e.id)}
                          >
                            <Sparkles className="w-3 h-3 text-olive" />
                            AI reasoning
                            {expandedReason === e.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {isCategorized && emailAny.aiConfidence != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {emailAny.aiConfidence}% confidence
                          </span>
                        )}
                      </div>

                      {/* Expanded AI reasoning */}
                      {expandedReason === e.id && emailAny.aiReasoning && (
                        <div className="mt-2 p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600 italic">
                          {emailAny.aiReasoning}
                        </div>
                      )}
                    </div>

                      {/* Action buttons */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {!e.isRead && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => markRead.mutate({ emailId: e.id })}>
                          <CheckCheck className="w-3.5 h-3.5 mr-1" />Read
                        </Button>
                      )}
                      {/* Convert to Ticket button — only for categorized emails */}
                      {emailAny.convertedToTicketId ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 cursor-default"
                              onClick={() => window.location.href = "/dashboard/tickets"}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Ticket #{emailAny.convertedToTicketId}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">Click to view in Work Tickets</TooltipContent>
                        </Tooltip>
                      ) : isCategorized ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => openConvertDialog(e)}>
                              <Ticket className="w-3.5 h-3.5 mr-1" />Create Ticket
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">Convert this email into a work ticket</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
                              disabled>
                              <Ticket className="w-3.5 h-3.5 mr-1" />Create Ticket
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">Run AI categorization first (Re-tag button)</TooltipContent>
                        </Tooltip>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-olive/30 text-olive hover:bg-olive/10"
                        onClick={() => {
                          setDraftOpen(e.id);
                          draftReply.mutate({ subject: e.subject ?? "", body: (emailAny.fullBody ?? e.bodyPreview ?? "") });
                        }}>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />AI Reply
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-olive"
                            onClick={() => recategorize.mutate({ emailId: e.id })}
                            disabled={isRecategorizing}>
                            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRecategorizing ? "animate-spin" : ""}`} />
                            {isRecategorizing ? "..." : "Re-tag"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">Re-run AI categorization</TooltipContent>
                      </Tooltip>
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
                            <Button size="sm" className="bg-olive text-cream text-xs"
                              onClick={() => { navigator.clipboard.writeText(draft); toast.success("Copied to clipboard."); }}>
                              Copy
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs"
                              onClick={() => { setDraftOpen(null); setDraft(""); }}>
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
      {/* ─── Convert to Ticket Dialog ──────────────────────────────────────── */}
      <Dialog open={!!convertDialogEmail} onOpenChange={(open) => { if (!open) setConvertDialogEmail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-charcoal">
              <Ticket className="w-5 h-5 text-amber-600" />
              Create Work Ticket from Email
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              AI has pre-filled the fields below from the email. Review and adjust before creating.
            </DialogDescription>
          </DialogHeader>

          {convertDialogEmail && (
            <div className="space-y-4 py-2">
              {/* Email source info */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600">
                <Mail className="w-4 h-4 flex-shrink-0 mt-0.5 text-stone-400" />
                <div className="min-w-0">
                  <p className="font-medium text-stone-700 truncate">{convertDialogEmail.subject || "(No subject)"}</p>
                  <p className="mt-0.5">{convertDialogEmail.fromAddress ?? "Unknown sender"}</p>
                </div>
              </div>

              {/* Ticket Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ticket Title <span className="text-red-500">*</span></Label>
                <Input
                  value={ticketForm.title}
                  onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Describe the issue..."
                  className="text-sm"
                />
              </div>

              {/* Property */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Property <span className="text-red-500">*</span></Label>
                <Select
                  value={ticketForm.propertyId}
                  onValueChange={v => setTicketForm(f => ({ ...f, propertyId: v }))}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(properties ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {convertDialogEmail.aiMatchedPropertyId && (
                  <p className="text-[10px] text-olive flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI matched: {propertyMap[convertDialogEmail.aiMatchedPropertyId] ?? "Unknown property"}
                  </p>
                )}
              </div>

              {/* Priority + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <Select
                    value={ticketForm.priority}
                    onValueChange={v => setTicketForm(f => ({ ...f, priority: v as any }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  {convertDialogEmail.aiUrgency && (
                    <p className="text-[10px] text-olive flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI: {convertDialogEmail.aiUrgency}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Category</Label>
                  <Select
                    value={ticketForm.category}
                    onValueChange={v => setTicketForm(f => ({ ...f, category: v }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="common_area">Common Area</SelectItem>
                      <SelectItem value="unit_related">Unit Related</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="board_matter">Board Matter</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Unit Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unit Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={ticketForm.unitNumber}
                  onChange={e => setTicketForm(f => ({ ...f, unitNumber: e.target.value }))}
                  placeholder="e.g. 4B"
                  className="text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  value={ticketForm.description}
                  onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="text-sm resize-none"
                  placeholder="Additional context..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConvertDialogEmail(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!ticketForm.title || !ticketForm.propertyId || convertToTicket.isPending}
              onClick={() => {
                if (!convertDialogEmail || !ticketForm.propertyId) return;
                convertToTicket.mutate({
                  emailId: convertDialogEmail.id,
                  propertyId: Number(ticketForm.propertyId),
                  title: ticketForm.title,
                  description: ticketForm.description || undefined,
                  priority: ticketForm.priority,
                  category: ticketForm.category as any,
                  unitNumber: ticketForm.unitNumber || undefined,
                });
              }}
            >
              {convertToTicket.isPending ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating...</>
              ) : (
                <><Ticket className="w-3.5 h-3.5 mr-1.5" />Create Ticket</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
