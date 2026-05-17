import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2, ClipboardList, Plus, ArrowLeft, MessageSquare,
  Clock, CheckCircle2, AlertTriangle, Wrench, ChevronRight,
  Send, Loader2, Home, LogIn, DollarSign, FileText, Mail,
  Phone, CreditCard, Download, Eye, EyeOff, TrendingDown,
  TrendingUp, Inbox, Reply, Paperclip, FolderOpen, Shield,
  BookOpen, FileCheck, ReceiptText, Bell, BellDot, FileCheck2,
  X, CheckCheck, Settings, ToggleLeft, ToggleRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type PortalView =
  | "welcome"
  | "select-property"
  | "home"
  | "new-request"
  | "my-tickets"
  | "ticket-detail"
  | "account-balance"
  | "make-payment"
  | "documents"
  | "messages"
  | "notifications"
  | "settings";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:           { label: "Open",           color: "bg-blue-100 text-blue-800",     icon: <Clock className="w-3 h-3" /> },
  in_progress:    { label: "In Progress",    color: "bg-amber-100 text-amber-800",   icon: <Wrench className="w-3 h-3" /> },
  pending_vendor: { label: "Pending Vendor", color: "bg-purple-100 text-purple-800", icon: <Clock className="w-3 h-3" /> },
  resolved:       { label: "Resolved",       color: "bg-green-100 text-green-800",   icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:         { label: "Closed",         color: "bg-gray-100 text-gray-600",     icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-800" },
  high:     { label: "High",     color: "bg-orange-100 text-orange-800" },
  medium:   { label: "Medium",   color: "bg-yellow-100 text-yellow-800" },
  low:      { label: "Low",      color: "bg-gray-100 text-gray-600" },
};

const CATEGORY_OPTIONS = [
  { value: "unit_related",  label: "Unit Issue (plumbing, electrical, appliances)" },
  { value: "common_area",   label: "Common Area (lobby, gym, pool, parking)" },
  { value: "emergency",     label: "Emergency (flood, fire hazard, gas leak)" },
  { value: "maintenance",   label: "General Maintenance" },
  { value: "vendor",        label: "Vendor / Contractor needed" },
  { value: "board_matter",  label: "Board / HOA Matter" },
  { value: "other",         label: "Other" },
];

const DOC_CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  governing_document: { label: "Governing Document", icon: <Shield className="w-4 h-4" />, color: "bg-blue-50 text-blue-700" },
  meeting_minutes:    { label: "Meeting Minutes",     icon: <BookOpen className="w-4 h-4" />, color: "bg-purple-50 text-purple-700" },
  financial_report:   { label: "Financial Report",    icon: <ReceiptText className="w-4 h-4" />, color: "bg-green-50 text-green-700" },
  insurance:          { label: "Insurance",           icon: <FileCheck className="w-4 h-4" />, color: "bg-amber-50 text-amber-700" },
  maintenance_record: { label: "Maintenance Record",  icon: <Wrench className="w-4 h-4" />, color: "bg-orange-50 text-orange-700" },
  notice:             { label: "Notice",              icon: <AlertTriangle className="w-4 h-4" />, color: "bg-red-50 text-red-700" },
  other:              { label: "Document",            icon: <FileText className="w-4 h-4" />, color: "bg-gray-50 text-gray-600" },
};

function formatCents(cents: number, currency = "USD") {
  const abs = Math.abs(cents) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(abs);
}

// ─── Portal Shell ─────────────────────────────────────────────────────────────
export default function ResidentPortal() {
  const { user, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<PortalView>("welcome");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const isOwner = user?.portierRole === "owner";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5C6B3A]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PortalLogin />;
  }

  function goBack() {
    if (view === "ticket-detail") setView("my-tickets");
    else if (view === "make-payment") setView("account-balance");
    else if (["new-request", "my-tickets", "account-balance", "documents", "messages", "notifications", "settings"].includes(view))
      setView("home");
    else setView("welcome");
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      {/* Portal Header */}
      <header className="bg-white border-b border-[#E8E0D0] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== "welcome" && view !== "home" && (
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-[#F0EBE0] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-[#3C3C3C]" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#5C6B3A]" />
              <span className="font-semibold text-[#3C3C3C] text-sm">
                {isOwner ? "Owner Portal" : "Resident Portal"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && selectedPropertyId && (
              <NotificationBell
                onOpen={() => setView("notifications")}
              />
            )}
            <div className="w-7 h-7 rounded-full bg-[#5C6B3A] flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? "R"}
            </div>
            <span className="text-sm text-[#666] hidden sm:block">{user?.name ?? "Resident"}</span>
          </div>
        </div>
      </header>

      {/* Portal Views */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {view === "welcome" && (
            <PortalWelcome key="welcome" user={user} isOwner={isOwner} onContinue={() => setView("select-property")} />
          )}
          {view === "select-property" && (
            <PropertySelector
              key="select"
              onSelect={(id) => { setSelectedPropertyId(id); setView("home"); }}
            />
          )}
          {view === "home" && selectedPropertyId && (
            <PortalHome
              key="home"
              propertyId={selectedPropertyId}
              isOwner={isOwner}
              onNewRequest={() => setView("new-request")}
              onMyTickets={() => setView("my-tickets")}
              onAccountBalance={() => setView("account-balance")}
              onDocuments={() => setView("documents")}
              onMessages={() => setView("messages")}
              onChangeProperty={() => setView("select-property")}
              onSettings={() => setView("settings")}
            />
          )}
          {view === "new-request" && selectedPropertyId && (
            <NewRequestForm
              key="new-request"
              propertyId={selectedPropertyId}
              onSuccess={() => { toast.success("Request submitted!"); setView("my-tickets"); }}
              onCancel={() => setView("home")}
            />
          )}
          {view === "my-tickets" && (
            <MyTickets
              key="my-tickets"
              onViewTicket={(id) => { setSelectedTicketId(id); setView("ticket-detail"); }}
            />
          )}
          {view === "ticket-detail" && selectedTicketId && (
            <TicketDetail
              key="ticket-detail"
              ticketId={selectedTicketId}
              onBack={() => setView("my-tickets")}
            />
          )}
          {view === "account-balance" && selectedPropertyId && (
            <AccountBalance
              key="account-balance"
              propertyId={selectedPropertyId}
              onMakePayment={() => setView("make-payment")}
            />
          )}
          {view === "make-payment" && selectedPropertyId && (
            <MakePayment
              key="make-payment"
              propertyId={selectedPropertyId}
              onSuccess={() => { toast.success("Payment submitted successfully!"); setView("account-balance"); }}
              onCancel={() => setView("account-balance")}
            />
          )}
          {view === "documents" && selectedPropertyId && (
            <SharedDocuments key="documents" propertyId={selectedPropertyId} />
          )}
          {view === "messages" && selectedPropertyId && (
            <OwnerMessages key="messages" propertyId={selectedPropertyId} />
          )}
          {view === "notifications" && (
            <NotificationsView
              key="notifications"
              onNavigate={(v, propertyId) => {
                // Set the property context before switching views so
                // messages/documents views (which require selectedPropertyId) work
                if (propertyId) setSelectedPropertyId(propertyId);
                setView(v as any);
              }}
            />
          )}
          {view === "settings" && (
            <NotificationSettings key="settings" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Login Gate ───────────────────────────────────────────────────────────────
function PortalLogin() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card className="border-[#E8E0D0] shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 bg-[#5C6B3A] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-[#3C3C3C] font-serif text-xl">Resident & Owner Portal</CardTitle>
            <CardDescription className="text-[#666]">
              Sign in to manage your account, submit requests, and access property documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-[#5C6B3A] hover:bg-[#4A5730] text-white"
              onClick={() => window.location.href = getLoginUrl("/portal")}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Continue
            </Button>
            <p className="text-xs text-center text-[#999] mt-4">
              Powered by Portier369 — White-Glove Condo Management
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────
function PortalWelcome({ user, isOwner, onContinue }: { user: any; isOwner: boolean; onContinue: () => void }) {
  const features = isOwner
    ? [
        { icon: <DollarSign className="w-5 h-5" />, label: "Account Balance" },
        { icon: <ClipboardList className="w-5 h-5" />, label: "My Requests" },
        { icon: <FolderOpen className="w-5 h-5" />, label: "Documents" },
        { icon: <MessageSquare className="w-5 h-5" />, label: "Message Us" },
      ]
    : [
        { icon: <Plus className="w-5 h-5" />, label: "Submit Requests" },
        { icon: <ClipboardList className="w-5 h-5" />, label: "Track Status" },
        { icon: <MessageSquare className="w-5 h-5" />, label: "Add Comments" },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="text-center py-8"
    >
      <div className="w-16 h-16 bg-[#5C6B3A] rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Home className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-serif font-semibold text-[#3C3C3C] mb-2">
        Welcome back, {user?.name?.split(" ")[0] ?? "Resident"}
      </h1>
      <p className="text-[#666] mb-8 max-w-sm mx-auto">
        {isOwner
          ? "Your owner portal — manage your account, view balances, access documents, and communicate with management."
          : "Your dedicated portal for submitting maintenance requests and tracking their progress."}
      </p>
      <div className={`grid gap-4 mb-8 max-w-sm mx-auto ${isOwner ? "grid-cols-4" : "grid-cols-3"}`}>
        {features.map((item, i) => (
          <div key={i} className="bg-white rounded-xl p-3 border border-[#E8E0D0] text-center">
            <div className="text-[#5C6B3A] flex justify-center mb-1">{item.icon}</div>
            <p className="text-xs text-[#666]">{item.label}</p>
          </div>
        ))}
      </div>
      <Button
        className="bg-[#5C6B3A] hover:bg-[#4A5730] text-white px-8"
        onClick={onContinue}
      >
        Get Started <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

// ─── Property Selector ────────────────────────────────────────────────────────
function PropertySelector({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: properties, isLoading } = trpc.portal.listProperties.useQuery();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">Select Your Property</h2>
      <p className="text-[#666] text-sm mb-5">Choose the condominium you live in</p>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" />
        </div>
      )}

      {!isLoading && (!properties || properties.length === 0) && (
        <Card className="border-[#E8E0D0] text-center py-10">
          <CardContent>
            <Building2 className="w-10 h-10 text-[#CCC] mx-auto mb-3" />
            <p className="text-[#666] text-sm">No properties found for your account.</p>
            <p className="text-[#999] text-xs mt-1">Contact your property manager to be added.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {properties?.map((property) => (
          <motion.div key={property.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Card
              className="border-[#E8E0D0] cursor-pointer hover:border-[#5C6B3A] hover:shadow-md transition-all"
              onClick={() => onSelect(property.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F0EBE0] rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#5C6B3A]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#3C3C3C]">{property.name}</p>
                    <p className="text-xs text-[#999]">{property.address ?? "Address on file"}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#999]" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Portal Home ──────────────────────────────────────────────────────────────
function PortalHome({
  propertyId, isOwner, onNewRequest, onMyTickets, onAccountBalance,
  onDocuments, onMessages, onChangeProperty, onSettings
}: {
  propertyId: number;
  isOwner: boolean;
  onNewRequest: () => void;
  onMyTickets: () => void;
  onAccountBalance: () => void;
  onDocuments: () => void;
  onMessages: () => void;
  onChangeProperty: () => void;
  onSettings: () => void;
}) {
  const { data: property } = trpc.portal.getProperty.useQuery({ propertyId });
  const { data: tickets } = trpc.portal.myTickets.useQuery();
  const { data: balance } = trpc.portal.getAccountBalance.useQuery(
    { propertyId },
    { enabled: isOwner }
  );

  const openCount = useMemo(() => tickets?.filter(t => t.status !== "closed" && t.status !== "resolved").length ?? 0, [tickets]);
  const resolvedCount = useMemo(() => tickets?.filter(t => t.status === "resolved" || t.status === "closed").length ?? 0, [tickets]);

  const quickActions = [
    { icon: <Plus className="w-6 h-6" />, label: "New Request", sub: "Submit a maintenance request", onClick: onNewRequest, primary: true },
    { icon: <ClipboardList className="w-6 h-6" />, label: "My Requests", sub: "Track your submissions", onClick: onMyTickets, primary: false },
    ...(isOwner ? [
      { icon: <DollarSign className="w-6 h-6" />, label: "Account Balance", sub: "View balance & pay", onClick: onAccountBalance, primary: false },
      { icon: <FolderOpen className="w-6 h-6" />, label: "Documents", sub: "Governing docs & minutes", onClick: onDocuments, primary: false },
      { icon: <MessageSquare className="w-6 h-6" />, label: "Contact Us", sub: "Message management", onClick: onMessages, primary: false },
      { icon: <Settings className="w-6 h-6" />, label: "Settings", sub: "Notification preferences", onClick: onSettings, primary: false },
    ] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      {/* Property Banner */}
      <div className="bg-[#5C6B3A] rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#B8C99A] text-xs uppercase tracking-wider mb-1">Your Property</p>
            <h2 className="text-lg font-serif font-semibold">{property?.name ?? "Loading..."}</h2>
            <p className="text-[#B8C99A] text-sm">{property?.address ?? ""}</p>
          </div>
          <button
            onClick={onChangeProperty}
            className="text-[#B8C99A] text-xs underline hover:text-white transition-colors"
          >
            Change
          </button>
        </div>
        <div className={`grid gap-3 mt-4 ${isOwner ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-2xl font-bold">{openCount}</p>
            <p className="text-[#B8C99A] text-xs">Open Requests</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-2xl font-bold">{resolvedCount}</p>
            <p className="text-[#B8C99A] text-xs">Resolved</p>
          </div>
          {isOwner && (
            <div className="bg-white/10 rounded-xl p-3">
              <p className={`text-2xl font-bold ${(balance?.balanceCents ?? 0) > 0 ? "text-red-300" : "text-green-300"}`}>
                {balance ? formatCents(balance.balanceCents) : "—"}
              </p>
              <p className="text-[#B8C99A] text-xs">
                {(balance?.balanceCents ?? 0) > 0 ? "Balance Due" : "Balance"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`grid gap-3 mb-5 ${isOwner ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
        {quickActions.map((action, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={action.onClick}
            className={`rounded-2xl p-4 text-left transition-colors ${
              action.primary
                ? "bg-white border-2 border-[#5C6B3A] hover:bg-[#F8F5EF]"
                : "bg-white border border-[#E8E0D0] hover:border-[#5C6B3A]"
            }`}
          >
            <div className="text-[#5C6B3A] mb-2">{action.icon}</div>
            <p className="font-semibold text-[#3C3C3C] text-sm">{action.label}</p>
            <p className="text-[#999] text-xs mt-0.5">{action.sub}</p>
          </motion.button>
        ))}
      </div>

      {/* Recent Tickets */}
      {tickets && tickets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#3C3C3C] text-sm">Recent Requests</h3>
            <button onClick={onMyTickets} className="text-xs text-[#5C6B3A] hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {tickets.slice(0, 3).map((ticket) => {
              const status = STATUS_CONFIG[ticket.status ?? "open"] ?? STATUS_CONFIG.open;
              return (
                <div key={ticket.id} className="bg-white border border-[#E8E0D0] rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#3C3C3C] truncate">{ticket.title}</p>
                    <p className="text-xs text-[#999]">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={`${status.color} text-xs ml-2 flex items-center gap-1 border-0`}>
                    {status.icon} {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── New Request Form ─────────────────────────────────────────────────────────
function NewRequestForm({
  propertyId, onSuccess, onCancel
}: {
  propertyId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", category: "", unitNumber: "" });

  const submitMutation = trpc.portal.submitRequest.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Failed to submit request"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Please enter a title"); return; }
    submitMutation.mutate({
      propertyId,
      title: form.title,
      description: form.description || undefined,
      category: (form.category as any) || undefined,
      unitNumber: form.unitNumber || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">New Maintenance Request</h2>
      <p className="text-[#666] text-sm mb-5">Describe the issue and we'll get it handled.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-[#E8E0D0]">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Issue Title *</Label>
              <Input
                className="mt-1.5 border-[#E8E0D0] focus:border-[#5C6B3A]"
                placeholder="e.g. Leaking faucet in kitchen"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1.5 border-[#E8E0D0]">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Unit Number</Label>
              <Input
                className="mt-1.5 border-[#E8E0D0] focus:border-[#5C6B3A]"
                placeholder="e.g. 4B, 12, PH-2"
                value={form.unitNumber}
                onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Description</Label>
              <Textarea
                className="mt-1.5 border-[#E8E0D0] focus:border-[#5C6B3A] resize-none"
                placeholder="Please describe the issue in detail — when it started, how severe it is, any relevant context..."
                rows={4}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {form.category === "emergency" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">
              <strong>Emergency?</strong> If there is immediate danger, please call 911 first.
              This form will also alert your property manager immediately.
            </p>
          </motion.div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 border-[#E8E0D0]" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-[#5C6B3A] hover:bg-[#4A5730] text-white"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Request</>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── My Tickets List ──────────────────────────────────────────────────────────
function MyTickets({ onViewTicket }: { onViewTicket: (id: number) => void }) {
  const { data: tickets, isLoading } = trpc.portal.myTickets.useQuery();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const filtered = useMemo(() => {
    if (!tickets) return [];
    if (filter === "open") return tickets.filter(t => t.status !== "closed" && t.status !== "resolved");
    if (filter === "resolved") return tickets.filter(t => t.status === "closed" || t.status === "resolved");
    return tickets;
  }, [tickets, filter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">My Requests</h2>
      <p className="text-[#666] text-sm mb-4">Track the status of your maintenance submissions</p>

      <div className="flex gap-2 mb-4">
        {(["all", "open", "resolved"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-[#5C6B3A] text-white"
                : "bg-white border border-[#E8E0D0] text-[#666] hover:border-[#5C6B3A]"
            }`}
          >
            {f === "all" ? `All (${tickets?.length ?? 0})`
              : f === "open" ? `Open (${tickets?.filter(t => t.status !== "closed" && t.status !== "resolved").length ?? 0})`
              : `Resolved (${tickets?.filter(t => t.status === "closed" || t.status === "resolved").length ?? 0})`}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" /></div>}

      {!isLoading && filtered.length === 0 && (
        <Card className="border-[#E8E0D0] text-center py-10">
          <CardContent>
            <ClipboardList className="w-10 h-10 text-[#CCC] mx-auto mb-3" />
            <p className="text-[#666] text-sm">No requests yet.</p>
            <p className="text-[#999] text-xs mt-1">Submit a maintenance request to get started.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((ticket) => {
          const status = STATUS_CONFIG[ticket.status ?? "open"] ?? STATUS_CONFIG.open;
          const priority = PRIORITY_CONFIG[ticket.priority ?? "medium"] ?? PRIORITY_CONFIG.medium;
          return (
            <motion.div key={ticket.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Card
                className="border-[#E8E0D0] cursor-pointer hover:border-[#5C6B3A] hover:shadow-sm transition-all"
                onClick={() => onViewTicket(ticket.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#3C3C3C] text-sm">{ticket.title}</p>
                      <p className="text-xs text-[#999] mt-0.5">
                        #{ticket.id} · {new Date(ticket.createdAt).toLocaleDateString()}
                        {ticket.unitNumber && ` · Unit ${ticket.unitNumber}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#CCC] flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`${status.color} text-xs flex items-center gap-1 border-0`}>
                      {status.icon} {status.label}
                    </Badge>
                    <Badge className={`${priority.color} text-xs border-0`}>{priority.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Ticket Detail ────────────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [newComment, setNewComment] = useState("");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portal.getTicket.useQuery({ ticketId });

  const addCommentMutation = trpc.portal.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.portal.getTicket.invalidate({ ticketId });
      toast.success("Comment added");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" /></div>;

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-[#666]">Ticket not found.</p>
        <Button variant="outline" className="mt-3" onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const { ticket, comments, property } = data;
  const status = STATUS_CONFIG[ticket.status ?? "open"] ?? STATUS_CONFIG.open;
  const priority = PRIORITY_CONFIG[ticket.priority ?? "medium"] ?? PRIORITY_CONFIG.medium;
  const steps = ["open", "in_progress", "pending_vendor", "resolved", "closed"];
  const currentStepIdx = steps.indexOf(ticket.status ?? "open");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      <Card className="border-[#E8E0D0]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-[#999] mb-1">Request #{ticket.id}</p>
              <h3 className="font-semibold text-[#3C3C3C]">{ticket.title}</h3>
              {property && <p className="text-xs text-[#999] mt-0.5">{property.name}</p>}
            </div>
            <Badge className={`${status.color} text-xs flex items-center gap-1 border-0 shrink-0`}>
              {status.icon} {status.label}
            </Badge>
          </div>
          <div className="flex gap-2 mb-3">
            <Badge className={`${priority.color} text-xs border-0`}>{priority.label} Priority</Badge>
            {ticket.category && (
              <Badge className="bg-gray-100 text-gray-600 text-xs border-0 capitalize">
                {ticket.category.replace(/_/g, " ")}
              </Badge>
            )}
            {ticket.unitNumber && (
              <Badge className="bg-blue-50 text-blue-700 text-xs border-0">Unit {ticket.unitNumber}</Badge>
            )}
          </div>
          {ticket.description && (
            <p className="text-sm text-[#555] bg-[#FAF8F4] rounded-lg p-3">{ticket.description}</p>
          )}
          <p className="text-xs text-[#999] mt-3">
            Submitted {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">Progress</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => {
              const isPast = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isCurrent ? "bg-[#5C6B3A] text-white" : isPast ? "bg-[#B8C99A] text-white" : "bg-[#E8E0D0] text-[#999]"
                  }`}>
                    {isPast ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${isPast && idx < currentStepIdx ? "bg-[#B8C99A]" : "bg-[#E8E0D0]"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {steps.map((step) => (
              <p key={step} className="text-[10px] text-[#999] capitalize" style={{ width: "20%", textAlign: "center" }}>
                {step.replace(/_/g, " ")}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">Updates & Comments</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {comments.length === 0 ? (
            <p className="text-sm text-[#999] text-center py-4">No updates yet. We'll post progress here.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-[#FAF8F4] rounded-xl p-3">
                  <p className="text-sm text-[#3C3C3C]">{comment.content}</p>
                  <p className="text-xs text-[#999] mt-1">{new Date(comment.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Textarea
              className="border-[#E8E0D0] focus:border-[#5C6B3A] resize-none text-sm"
              placeholder="Add a comment or question..."
              rows={2}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
            />
            <Button
              className="bg-[#5C6B3A] hover:bg-[#4A5730] text-white shrink-0"
              disabled={!newComment.trim() || addCommentMutation.isPending}
              onClick={() => addCommentMutation.mutate({ ticketId, content: newComment })}
            >
              {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Account Balance ──────────────────────────────────────────────────────────
function AccountBalance({ propertyId, onMakePayment }: { propertyId: number; onMakePayment: () => void }) {
  const [showBalance, setShowBalance] = useState(true);
  const { data, isLoading } = trpc.portal.getAccountBalance.useQuery({ propertyId });

  const balanceCents = data?.balanceCents ?? 0;
  const isOwed = balanceCents > 0;
  const isCredit = balanceCents < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">Account Balance</h2>
        <p className="text-[#666] text-sm">Your current account standing with the management company</p>
      </div>

      {/* Balance Card */}
      <div className={`rounded-2xl p-6 text-white ${isOwed ? "bg-gradient-to-br from-red-600 to-red-700" : isCredit ? "bg-gradient-to-br from-[#5C6B3A] to-[#4A5730]" : "bg-gradient-to-br from-[#5C6B3A] to-[#4A5730]"}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/70 text-sm uppercase tracking-wider">
            {isOwed ? "Amount Due" : isCredit ? "Credit Balance" : "Current Balance"}
          </p>
          <button onClick={() => setShowBalance(v => !v)} className="text-white/70 hover:text-white">
            {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-end gap-2 mb-4">
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <p className="text-4xl font-bold">
              {showBalance ? formatCents(balanceCents, "USD") : "••••••"}
            </p>
          )}
          {isOwed && <TrendingUp className="w-5 h-5 text-red-300 mb-1" />}
          {isCredit && <TrendingDown className="w-5 h-5 text-green-300 mb-1" />}
        </div>
        {data?.notes && <p className="text-white/70 text-xs">{data.notes}</p>}
        {isOwed && (
          <Button
            onClick={onMakePayment}
            className="mt-4 bg-white text-red-700 hover:bg-red-50 font-semibold w-full"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Make a Payment
          </Button>
        )}
        {!isOwed && (
          <Button
            onClick={onMakePayment}
            variant="outline"
            className="mt-4 border-white/30 text-white hover:bg-white/10 w-full"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Make a Payment
          </Button>
        )}
      </div>

      {/* Transaction History */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#5C6B3A]" /></div>}
          {!isLoading && (!data?.transactions || data.transactions.length === 0) && (
            <div className="text-center py-6">
              <ReceiptText className="w-8 h-8 text-[#CCC] mx-auto mb-2" />
              <p className="text-sm text-[#999]">No transactions yet</p>
            </div>
          )}
          <div className="space-y-2">
            {data?.transactions?.map((tx) => {
              const isPayment = tx.amountCents > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#F0EBE0] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPayment ? "bg-green-50" : "bg-red-50"}`}>
                      {isPayment ? <TrendingDown className="w-4 h-4 text-green-600" /> : <TrendingUp className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#3C3C3C]">{tx.description ?? (isPayment ? "Payment" : "Charge")}</p>
                      <p className="text-xs text-[#999]">
                        {new Date(tx.createdAt).toLocaleDateString()} · {tx.method?.replace(/_/g, " ")}
                        {tx.referenceNumber && ` · #${tx.referenceNumber}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isPayment ? "text-green-600" : "text-red-600"}`}>
                      {isPayment ? "-" : "+"}{formatCents(tx.amountCents, "USD")}
                    </p>
                    <Badge className={`text-xs border-0 ${
                      tx.status === "confirmed" ? "bg-green-50 text-green-700"
                        : tx.status === "pending" ? "bg-amber-50 text-amber-700"
                        : tx.status === "failed" ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-600"
                    }`}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Make Payment ─────────────────────────────────────────────────────────────
function MakePayment({
  propertyId, onSuccess, onCancel
}: {
  propertyId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    amountDollars: "",
    method: "ach" as "ach" | "credit_card" | "check" | "cash" | "other",
    description: "",
    referenceNumber: "",
  });

  const payMutation = trpc.portal.makePayment.useMutation({
    onSuccess,
    onError: (err) => toast.error(err.message || "Payment failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dollars = parseFloat(form.amountDollars);
    if (isNaN(dollars) || dollars <= 0) { toast.error("Please enter a valid amount"); return; }
    payMutation.mutate({
      propertyId,
      amountCents: Math.round(dollars * 100),
      method: form.method,
      description: form.description || undefined,
      referenceNumber: form.referenceNumber || undefined,
    });
  };

  const METHOD_LABELS: Record<string, string> = {
    ach: "ACH Bank Transfer",
    credit_card: "Credit / Debit Card",
    check: "Check",
    wire: "Wire Transfer",
    other: "Other",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">Make a Payment</h2>
      <p className="text-[#666] text-sm mb-5">Submit your payment details below</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          This records your payment intent. Your management company will process and confirm the payment.
          For immediate assistance, please contact the office directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-[#E8E0D0]">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Payment Amount (USD) *</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666] font-medium">$</span>
                <Input
                  className="pl-7 border-[#E8E0D0] focus:border-[#5C6B3A] text-lg font-semibold"
                  placeholder="0.00"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amountDollars}
                  onChange={e => setForm(f => ({ ...f, amountDollars: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Payment Method</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v as any }))}>
                <SelectTrigger className="mt-1.5 border-[#E8E0D0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Description / Memo</Label>
              <Input
                className="mt-1.5 border-[#E8E0D0] focus:border-[#5C6B3A]"
                placeholder="e.g. Monthly maintenance fee — June 2025"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-[#3C3C3C] text-sm font-medium">Reference / Check Number</Label>
              <Input
                className="mt-1.5 border-[#E8E0D0] focus:border-[#5C6B3A]"
                placeholder="Optional — check #, transaction ID, etc."
                value={form.referenceNumber}
                onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 border-[#E8E0D0]" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-[#5C6B3A] hover:bg-[#4A5730] text-white"
            disabled={payMutation.isPending}
          >
            {payMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Submit Payment</>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Shared Documents ─────────────────────────────────────────────────────────
function SharedDocuments({ propertyId }: { propertyId: number }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { data: docs, isLoading } = trpc.portal.listDocuments.useQuery({ propertyId });

  const categories = useMemo(() => {
    if (!docs) return [];
    const cats = new Set(docs.map(d => d.category));
    return Array.from(cats);
  }, [docs]);

  const filtered = useMemo(() => {
    if (!docs) return [];
    if (categoryFilter === "all") return docs;
    return docs.filter(d => d.category === categoryFilter);
  }, [docs, categoryFilter]);

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <div className="mb-5">
        <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">Property Documents</h2>
        <p className="text-[#666] text-sm">Governing documents, meeting minutes, and other shared files</p>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "all" ? "bg-[#5C6B3A] text-white" : "bg-white border border-[#E8E0D0] text-[#666] hover:border-[#5C6B3A]"
            }`}
          >
            All ({docs?.length ?? 0})
          </button>
          {categories.map(cat => {
            const config = DOC_CATEGORY_CONFIG[cat] ?? DOC_CATEGORY_CONFIG.other;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === cat ? "bg-[#5C6B3A] text-white" : "bg-white border border-[#E8E0D0] text-[#666] hover:border-[#5C6B3A]"
                }`}
              >
                {config.label} ({docs?.filter(d => d.category === cat).length ?? 0})
              </button>
            );
          })}
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" /></div>}

      {!isLoading && filtered.length === 0 && (
        <Card className="border-[#E8E0D0] text-center py-12">
          <CardContent>
            <FolderOpen className="w-12 h-12 text-[#CCC] mx-auto mb-3" />
            <p className="text-[#666] text-sm font-medium">No documents available</p>
            <p className="text-[#999] text-xs mt-1">
              {categoryFilter !== "all" ? "No documents in this category." : "Your management company hasn't shared any documents yet."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((doc) => {
          const config = DOC_CATEGORY_CONFIG[doc.category ?? "other"] ?? DOC_CATEGORY_CONFIG.other;
          const isPdf = doc.mimeType === "application/pdf";
          const isImage = doc.mimeType.startsWith("image/");
          return (
            <motion.div key={doc.id} whileHover={{ scale: 1.01 }}>
              <Card className="border-[#E8E0D0] hover:border-[#5C6B3A] hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#3C3C3C] text-sm">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-[#666] mt-0.5 line-clamp-2">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={`text-xs border-0 ${config.color}`}>{config.label}</Badge>
                        <span className="text-xs text-[#999]">{formatFileSize(doc.fileSize)}</span>
                        <span className="text-xs text-[#999]">{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="shrink-0 p-2 rounded-lg bg-[#F0EBE0] hover:bg-[#E8E0D0] transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-[#5C6B3A]" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Owner Messages ───────────────────────────────────────────────────────────
function OwnerMessages({ propertyId }: { propertyId: number }) {
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState<"in_app" | "email" | "text">("in_app");
  const utils = trpc.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = trpc.portal.getMessages.useQuery({ propertyId });

  const sendMutation = trpc.portal.sendMessage.useMutation({
    onSuccess: () => {
      setBody("");
      setSubject("");
      utils.portal.getMessages.invalidate({ propertyId });
      toast.success("Message sent to management");
    },
    onError: (err) => toast.error(err.message),
  });

  const CHANNEL_CONFIG = {
    in_app:  { label: "In-App",  icon: <Inbox className="w-4 h-4" />,   desc: "Receive replies here in the portal" },
    email:   { label: "Email",   icon: <Mail className="w-4 h-4" />,    desc: "Management will reply to your email" },
    text:    { label: "Text",    icon: <Phone className="w-4 h-4" />,   desc: "Request a text message reply" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-serif font-semibold text-[#3C3C3C] mb-1">Contact Management</h2>
        <p className="text-[#666] text-sm">Send a message directly to your property management team</p>
      </div>

      {/* Message Thread */}
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#5C6B3A]" /></div>}

      {!isLoading && messages && messages.length > 0 && (
        <Card className="border-[#E8E0D0]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-[#3C3C3C]">Message Thread</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 max-h-80 overflow-y-auto">
            <div className="space-y-3" ref={messagesEndRef}>
              {messages.map((msg) => {
                const isOwnerMsg = msg.direction === "owner_to_manager";
                return (
                  <div key={msg.id} className={`flex ${isOwnerMsg ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isOwnerMsg
                        ? "bg-[#5C6B3A] text-white rounded-br-sm"
                        : "bg-[#F0EBE0] text-[#3C3C3C] rounded-bl-sm"
                    }`}>
                      {msg.subject && (
                        <p className={`text-xs font-semibold mb-1 ${isOwnerMsg ? "text-[#B8C99A]" : "text-[#5C6B3A]"}`}>
                          {msg.subject}
                        </p>
                      )}
                      <p className="text-sm">{msg.body}</p>
                      <p className={`text-xs mt-1 ${isOwnerMsg ? "text-[#B8C99A]" : "text-[#999]"}`}>
                        {new Date(msg.createdAt).toLocaleString()}
                        {isOwnerMsg && ` · via ${msg.channel?.replace("_", " ")}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compose New Message */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">
            {messages && messages.length > 0 ? "Reply" : "New Message"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Channel selector */}
          <div>
            <Label className="text-[#3C3C3C] text-xs font-medium mb-2 block">Preferred Response Channel</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["in_app", "email", "text"] as const).map(ch => {
                const cfg = CHANNEL_CONFIG[ch];
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-xl p-2.5 text-left border transition-all ${
                      channel === ch
                        ? "border-[#5C6B3A] bg-[#F0EBE0]"
                        : "border-[#E8E0D0] bg-white hover:border-[#5C6B3A]"
                    }`}
                  >
                    <div className={`mb-1 ${channel === ch ? "text-[#5C6B3A]" : "text-[#999]"}`}>{cfg.icon}</div>
                    <p className="text-xs font-medium text-[#3C3C3C]">{cfg.label}</p>
                    <p className="text-[10px] text-[#999] leading-tight">{cfg.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject (optional) */}
          <div>
            <Label className="text-[#3C3C3C] text-xs font-medium">Subject (optional)</Label>
            <Input
              className="mt-1 border-[#E8E0D0] focus:border-[#5C6B3A] text-sm"
              placeholder="e.g. Question about parking policy"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Message body */}
          <div>
            <Label className="text-[#3C3C3C] text-xs font-medium">Message *</Label>
            <Textarea
              className="mt-1 border-[#E8E0D0] focus:border-[#5C6B3A] resize-none text-sm"
              placeholder="Type your message here..."
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-[#5C6B3A] hover:bg-[#4A5730] text-white"
            disabled={!body.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate({ propertyId, body, subject: subject || undefined, channel })}
          >
            {sendMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send Message</>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Notification Bell (header widget) ───────────────────────────────────────
function NotificationBell({ onOpen }: { onOpen: () => void }) {
  const { data } = trpc.portal.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });
  const unread = data?.count ?? 0;

  return (
    <button
      onClick={onOpen}
      className="relative p-1.5 rounded-lg hover:bg-[#F0EBE0] transition-colors"
      aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
    >
      {unread > 0 ? (
        <BellDot className="w-5 h-5 text-[#5C6B3A]" />
      ) : (
        <Bell className="w-5 h-5 text-[#999]" />
      )}
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// ─── Notifications View ───────────────────────────────────────────────────────
function NotificationsView({ onNavigate }: { onNavigate?: (view: string, propertyId?: number) => void }) {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.portal.getNotifications.useQuery();

  const markReadMutation = trpc.portal.markNotificationRead.useMutation({
    onSuccess: () => {
      utils.portal.getNotifications.invalidate();
      utils.portal.getUnreadCount.invalidate();
    },
  });

  const markAllMutation = trpc.portal.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      utils.portal.getNotifications.invalidate();
      utils.portal.getUnreadCount.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    document_shared:  { icon: <FileCheck2 className="w-4 h-4" />, color: "text-blue-700",  bg: "bg-blue-50" },
    payment_due:      { icon: <DollarSign className="w-4 h-4" />, color: "text-red-700",   bg: "bg-red-50" },
    message_received: { icon: <MessageSquare className="w-4 h-4" />, color: "text-purple-700", bg: "bg-purple-50" },
    ticket_update:    { icon: <Wrench className="w-4 h-4" />,     color: "text-amber-700", bg: "bg-amber-50" },
    general:          { icon: <Bell className="w-4 h-4" />,       color: "text-gray-700",  bg: "bg-gray-50" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-semibold text-[#3C3C3C]">Notifications</h2>
          <p className="text-[#666] text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#E8E0D0] text-[#5C6B3A] hover:bg-[#F0EBE0] text-xs"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" />
        </div>
      )}

      {!isLoading && (!notifications || notifications.length === 0) && (
        <Card className="border-[#E8E0D0] text-center py-14">
          <CardContent>
            <Bell className="w-12 h-12 text-[#CCC] mx-auto mb-3" />
            <p className="text-[#666] text-sm font-medium">No notifications yet</p>
            <p className="text-[#999] text-xs mt-1">
              You'll be notified here when documents are shared, your manager replies to a message, your maintenance request status changes, or other updates are posted.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {notifications?.map((notif) => {
          const cfg = TYPE_CONFIG[notif.type ?? "general"] ?? TYPE_CONFIG.general;
          const isUnread = !notif.isRead;
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              layout
            >
              <Card
                className={`border transition-all cursor-pointer ${
                  isUnread
                    ? "border-[#5C6B3A]/30 bg-[#F8FBF5] hover:border-[#5C6B3A]"
                    : "border-[#E8E0D0] bg-white hover:border-[#5C6B3A]/50"
                }`}
                onClick={() => {
                  if (isUnread) {
                    markReadMutation.mutate({ notificationId: notif.id });
                  }
                  // Navigate to the relevant portal view on click, passing propertyId
                  // so the parent can set selectedPropertyId before switching views
                  if (notif.type === "message_received" && onNavigate) {
                    onNavigate("messages", notif.propertyId ?? undefined);
                  } else if (notif.type === "document_shared" && onNavigate) {
                    onNavigate("documents", notif.propertyId ?? undefined);
                  } else if (notif.type === "ticket_update" && onNavigate) {
                    onNavigate("my-tickets", notif.propertyId ?? undefined);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${isUnread ? "text-[#2C2C2C]" : "text-[#555]"}`}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isUnread && (
                            <span className="w-2 h-2 bg-[#5C6B3A] rounded-full" />
                          )}
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markReadMutation.mutate({ notificationId: notif.id });
                              }}
                              className="p-0.5 rounded hover:bg-[#E8E0D0] transition-colors"
                              title="Mark as read"
                            >
                              <X className="w-3 h-3 text-[#999]" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isUnread ? "text-[#444]" : "text-[#888]"}`}>
                        {notif.body}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[10px] text-[#BBB]">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                        {notif.emailSent && (
                          <span className="flex items-center gap-0.5 text-[10px] text-[#5C6B3A]">
                            <Mail className="w-2.5 h-2.5" />
                            Email sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Notification Settings ────────────────────────────────────────────────────
function NotificationSettings() {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.portal.getNotificationPrefs.useQuery();

  const saveMutation = trpc.portal.saveNotificationPrefs.useMutation({
    onSuccess: () => {
      utils.portal.getNotificationPrefs.invalidate();
      toast.success("Notification preferences saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save preferences"),
  });

  // Local state mirrors server prefs; initialised once data loads
  const [local, setLocal] = useState<Record<string, boolean> | null>(null);

  // Sync local state when server data arrives
  useEffect(() => {
    if (prefs && !local) {
      setLocal({ ...prefs });
    }
  }, [prefs]);

  function toggle(key: string) {
    setLocal(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
  }

  function isDirty() {
    if (!prefs || !local) return false;
    return Object.keys(local).some(k => (local as any)[k] !== (prefs as any)[k]);
  }

  function handleSave() {
    if (!local) return;
    saveMutation.mutate(local as any);
  }

  // ── Notification type definitions ────────────────────────────────────────────
  const NOTIF_TYPES = [
    {
      key: "docShared",
      label: "Document Shared",
      description: "When your management company shares a new governing document, meeting minutes, or other file with you.",
      icon: <FileCheck2 className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
    },
    {
      key: "paymentDue",
      label: "Payment Due",
      description: "When a new charge or payment reminder is posted to your account.",
      icon: <DollarSign className="w-5 h-5 text-red-600" />,
      bg: "bg-red-50",
    },
    {
      key: "msgReceived",
      label: "Message Received",
      description: "When your property manager replies to one of your messages.",
      icon: <MessageSquare className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50",
    },
    {
      key: "ticketUpdate",
      label: "Request Update",
      description: "When the status of one of your maintenance requests changes.",
      icon: <Wrench className="w-5 h-5 text-amber-600" />,
      bg: "bg-amber-50",
    },
  ];

  // ── Toggle row component ──────────────────────────────────────────────────────
  function PrefRow({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: boolean;
    onChange: () => void;
    disabled?: boolean;
  }) {
    return (
      <div className="flex items-center justify-between py-2.5">
        <div className="flex items-center gap-2">
          {value
            ? <ToggleRight className="w-4 h-4 text-[#5C6B3A]" />
            : <ToggleLeft className="w-4 h-4 text-[#CCC]" />
          }
          <span className={`text-sm ${value ? "text-[#3C3C3C] font-medium" : "text-[#999]"}`}>{label}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          disabled={disabled}
          onClick={onChange}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#5C6B3A] focus:ring-offset-1 ${
            value ? "bg-[#5C6B3A]" : "bg-[#D1CBBD]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-serif font-semibold text-[#3C3C3C]">Notification Settings</h2>
          <p className="text-[#666] text-sm mt-0.5">
            Choose how you want to be alerted for each event type.
          </p>
        </div>
        <div className="w-10 h-10 bg-[#F0EBE0] rounded-xl flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-[#5C6B3A]" />
        </div>
      </div>

      {/* Channel legend */}
      <div className="flex items-center gap-4 bg-[#F8FBF5] border border-[#D4E0C4] rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-[#5C6B3A]" />
          <span className="text-xs text-[#5C6B3A] font-medium">In-App</span>
        </div>
        <span className="text-[#CCC] text-xs">—</span>
        <p className="text-xs text-[#666]">Shown in the notification bell inside this portal</p>
      </div>
      <div className="flex items-center gap-4 bg-[#FFF8F0] border border-[#F0D8B4] rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-xs text-amber-700 font-medium">Email</span>
        </div>
        <span className="text-[#CCC] text-xs">—</span>
        <p className="text-xs text-[#666]">Sent to the email address on your account</p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" />
        </div>
      )}

      {/* Preference cards */}
      {!isLoading && local && (
        <div className="space-y-3">
          {NOTIF_TYPES.map(({ key, label, description, icon, bg }) => (
            <Card key={key} className="border-[#E8E0D0]">
              <CardContent className="p-4">
                {/* Type header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#3C3C3C]">{label}</p>
                    <p className="text-xs text-[#888] leading-snug">{description}</p>
                  </div>
                </div>

                {/* Channel toggles */}
                <div className="border-t border-[#F0EBE0] divide-y divide-[#F0EBE0]">
                  <PrefRow
                    label="In-App notification"
                    value={local[`${key}InApp`] ?? true}
                    onChange={() => toggle(`${key}InApp`)}
                  />
                  <PrefRow
                    label="Email alert"
                    value={local[`${key}Email`] ?? true}
                    onChange={() => toggle(`${key}Email`)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save / discard bar */}
      {!isLoading && local && (
        <div className={`sticky bottom-4 transition-all duration-200 ${isDirty() ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
          <div className="bg-[#3C3C3C] rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl">
            <p className="text-white text-sm">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setLocal({ ...prefs! })}
              >
                Discard
              </Button>
              <Button
                size="sm"
                className="bg-[#5C6B3A] hover:bg-[#4A5730] text-white"
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
