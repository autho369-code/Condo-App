import { useState, useMemo } from "react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2, ClipboardList, Plus, ArrowLeft, MessageSquare,
  Clock, CheckCircle2, AlertTriangle, Wrench, ChevronRight,
  Send, Loader2, Home, LogIn
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type PortalView = "welcome" | "select-property" | "home" | "new-request" | "my-tickets" | "ticket-detail";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:           { label: "Open",           color: "bg-blue-100 text-blue-800",   icon: <Clock className="w-3 h-3" /> },
  in_progress:    { label: "In Progress",    color: "bg-amber-100 text-amber-800", icon: <Wrench className="w-3 h-3" /> },
  pending_vendor: { label: "Pending Vendor", color: "bg-purple-100 text-purple-800", icon: <Clock className="w-3 h-3" /> },
  resolved:       { label: "Resolved",       color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:         { label: "Closed",         color: "bg-gray-100 text-gray-600",   icon: <CheckCircle2 className="w-3 h-3" /> },
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

// ─── Portal Shell ─────────────────────────────────────────────────────────────
export default function ResidentPortal() {
  const { user, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<PortalView>("welcome");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

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

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      {/* Portal Header */}
      <header className="bg-white border-b border-[#E8E0D0] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== "welcome" && view !== "home" && (
              <button
                onClick={() => {
                  if (view === "ticket-detail") setView("my-tickets");
                  else if (view === "new-request" || view === "my-tickets") setView("home");
                  else setView("welcome");
                }}
                className="p-1.5 rounded-lg hover:bg-[#F0EBE0] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-[#3C3C3C]" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#5C6B3A]" />
              <span className="font-semibold text-[#3C3C3C] text-sm">Portier Resident Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <PortalWelcome key="welcome" user={user} onContinue={() => setView("select-property")} />
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
              onNewRequest={() => setView("new-request")}
              onMyTickets={() => setView("my-tickets")}
              onChangeProperty={() => setView("select-property")}
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
            <CardTitle className="text-[#3C3C3C] font-serif text-xl">Resident Portal</CardTitle>
            <CardDescription className="text-[#666]">
              Sign in to submit maintenance requests and track your tickets
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
function PortalWelcome({ user, onContinue }: { user: any; onContinue: () => void }) {
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
        Your dedicated portal for submitting maintenance requests and tracking their progress.
      </p>
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-sm mx-auto">
        {[
          { icon: <Plus className="w-5 h-5" />, label: "Submit Requests" },
          { icon: <ClipboardList className="w-5 h-5" />, label: "Track Status" },
          { icon: <MessageSquare className="w-5 h-5" />, label: "Add Comments" },
        ].map((item, i) => (
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
          <motion.div
            key={property.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
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
  propertyId, onNewRequest, onMyTickets, onChangeProperty
}: {
  propertyId: number;
  onNewRequest: () => void;
  onMyTickets: () => void;
  onChangeProperty: () => void;
}) {
  const { data: property } = trpc.portal.getProperty.useQuery({ propertyId });
  const { data: tickets } = trpc.portal.myTickets.useQuery();

  const openCount = useMemo(() => tickets?.filter(t => t.status !== "closed" && t.status !== "resolved").length ?? 0, [tickets]);
  const resolvedCount = useMemo(() => tickets?.filter(t => t.status === "resolved" || t.status === "closed").length ?? 0, [tickets]);

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
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-2xl font-bold">{openCount}</p>
            <p className="text-[#B8C99A] text-xs">Open Requests</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-2xl font-bold">{resolvedCount}</p>
            <p className="text-[#B8C99A] text-xs">Resolved</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewRequest}
          className="bg-white border-2 border-[#5C6B3A] rounded-2xl p-5 text-left hover:bg-[#F8F5EF] transition-colors"
        >
          <Plus className="w-7 h-7 text-[#5C6B3A] mb-2" />
          <p className="font-semibold text-[#3C3C3C] text-sm">New Request</p>
          <p className="text-[#999] text-xs mt-0.5">Submit a maintenance request</p>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onMyTickets}
          className="bg-white border border-[#E8E0D0] rounded-2xl p-5 text-left hover:border-[#5C6B3A] transition-colors"
        >
          <ClipboardList className="w-7 h-7 text-[#5C6B3A] mb-2" />
          <p className="font-semibold text-[#3C3C3C] text-sm">My Requests</p>
          <p className="text-[#999] text-xs mt-0.5">Track your submissions</p>
        </motion.button>
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
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    unitNumber: "",
  });

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

        {/* Emergency notice */}
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
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-[#E8E0D0]"
            onClick={onCancel}
          >
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

      {/* Filter tabs */}
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
            {f === "all" ? `All (${tickets?.length ?? 0})` : f === "open" ? `Open (${tickets?.filter(t => t.status !== "closed" && t.status !== "resolved").length ?? 0})` : `Resolved (${tickets?.filter(t => t.status === "closed" || t.status === "resolved").length ?? 0})`}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" />
        </div>
      )}

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
            <motion.div
              key={ticket.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
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
                    <Badge className={`${priority.color} text-xs border-0`}>
                      {priority.label}
                    </Badge>
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#5C6B3A]" />
      </div>
    );
  }

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

  // Build a simple timeline of status steps
  const steps = ["open", "in_progress", "pending_vendor", "resolved", "closed"];
  const currentStepIdx = steps.indexOf(ticket.status ?? "open");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      {/* Ticket Header */}
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
            Submitted {new Date(ticket.createdAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </CardContent>
      </Card>

      {/* Progress Timeline */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">Progress</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => {
              const isCompleted = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    isCompleted ? "bg-[#5C6B3A] text-white" : "bg-[#E8E0D0] text-[#999]"
                  } ${isCurrent ? "ring-2 ring-[#5C6B3A] ring-offset-1" : ""}`}>
                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-0.5 ${idx < currentStepIdx ? "bg-[#5C6B3A]" : "bg-[#E8E0D0]"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {steps.map((step) => (
              <p key={step} className="text-[9px] text-[#999] capitalize text-center" style={{ width: `${100 / steps.length}%` }}>
                {step.replace(/_/g, " ")}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card className="border-[#E8E0D0]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-[#3C3C3C]">
            Updates ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {comments.length === 0 && (
            <p className="text-xs text-[#999] text-center py-4">No updates yet. Your manager will post updates here.</p>
          )}
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#5C6B3A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
                  {comment.authorId === ticket.reportedById ? "Y" : "M"}
                </div>
                <div className="flex-1">
                  <div className="bg-[#FAF8F4] rounded-xl rounded-tl-none p-3">
                    <p className="text-sm text-[#3C3C3C]">{comment.content}</p>
                  </div>
                  <p className="text-[10px] text-[#999] mt-1 ml-1">
                    {comment.authorId === ticket.reportedById ? "You" : "Property Manager"} · {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="mb-3" />

          {/* Add comment */}
          {ticket.status !== "closed" && (
            <div className="flex gap-2">
              <Textarea
                className="border-[#E8E0D0] focus:border-[#5C6B3A] resize-none text-sm"
                placeholder="Add a comment or update..."
                rows={2}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <Button
                className="bg-[#5C6B3A] hover:bg-[#4A5730] text-white px-3 self-end"
                disabled={!newComment.trim() || addCommentMutation.isPending}
                onClick={() => addCommentMutation.mutate({ ticketId, content: newComment })}
              >
                {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
          {ticket.status === "closed" && (
            <p className="text-xs text-[#999] text-center">This ticket is closed. Contact your manager to reopen it.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
