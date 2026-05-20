import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import {
  Search, Plus, X, ChevronUp, ChevronDown, Users, Wrench,
  FileText, Mail, Phone, MapPin, Star, Download, Upload,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const TABS = ["Owners", "Vendors", "Board Members"] as const;
type Tab = typeof TABS[number];

const ALPHABET = ["All", "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

// ─── ADD OWNER MODAL ──────────────────────────────────────────────────────────
function AddOwnerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: properties } = trpc.properties.list.useQuery();
  const createOwner = trpc.owners.create.useMutation({
    onSuccess: () => { toast.success("Owner added successfully"); onSuccess(); onClose(); },
    onError: (err) => toast.error(err.message),
  });
  const [form, setForm] = useState({ propertyId: "", firstName: "", lastName: "", email: "", phone: "", unit: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId) { toast.error("Please select an association"); return; }
    if (!form.firstName.trim()) { toast.error("First name is required"); return; }
    if (!form.lastName.trim()) { toast.error("Last name is required"); return; }
    createOwner.mutate({
      propertyId: Number(form.propertyId),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      unit: form.unit.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(26,46,26,0.35)" }}>
      <div className="border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6" style={{ background: "#faf7f2" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Owner</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Association *</label>
            <select value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">Select association...</option>
              {(properties ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">First Name *</label>
              <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="John" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Last Name *</label>
              <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="john@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="(555) 000-0000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="101" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={createOwner.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createOwner.isPending ? "Saving..." : "Add Owner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ADD VENDOR MODAL ─────────────────────────────────────────────────────────
function AddVendorModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const createVendor = trpc.vendors.create.useMutation({
    onSuccess: () => { toast.success("Vendor added successfully"); onSuccess(); onClose(); },
    onError: (err) => toast.error(err.message),
  });
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", phone: "", address: "",
    paymentType: "check" as "check" | "ach" | "online" | "credit_card",
    w9OnFile: false, is1099Vendor: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) { toast.error("Company name is required"); return; }
    createVendor.mutate({
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      paymentType: form.paymentType,
      w9OnFile: form.w9OnFile,
      is1099Vendor: form.is1099Vendor,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(26,46,26,0.35)" }}>
      <div className="border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6" style={{ background: "#faf7f2" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Vendor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name *</label>
            <input type="text" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="ABC Landscaping" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Name</label>
            <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="vendor@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="(555) 000-0000" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Type</label>
            <select value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value as any }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="check">Check</option>
              <option value="ach">ACH</option>
              <option value="online">Online</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.w9OnFile} onChange={e => setForm(f => ({ ...f, w9OnFile: e.target.checked }))} className="rounded border-border" />
              W-9 on file
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.is1099Vendor} onChange={e => setForm(f => ({ ...f, is1099Vendor: e.target.checked }))} className="rounded border-border" />
              1099 Vendor
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={createVendor.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createVendor.isPending ? "Saving..." : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RIGHT PANE — CONTEXTUAL ACTIONS ─────────────────────────────────────────
function PeopleRightPane({
  activeTab,
  onAddOwner,
  onAddVendor,
  ownerCount,
  vendorCount,
}: {
  activeTab: Tab;
  onAddOwner: () => void;
  onAddVendor: () => void;
  ownerCount: number;
  vendorCount: number;
}) {
  return (
    <div className="panel-right h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <h3 className="text-sm font-semibold text-foreground">Actions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {activeTab === "Owners" ? `${ownerCount} owner${ownerCount !== 1 ? "s" : ""}` :
           activeTab === "Vendors" ? `${vendorCount} vendor${vendorCount !== 1 ? "s" : ""}` :
           "Board members"}
        </p>
      </div>

      {/* Primary actions */}
      <div className="p-3 border-b border-sidebar-border space-y-1.5">
        {activeTab === "Owners" && (
          <>
            <button onClick={onAddOwner}
              className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Owner
            </button>
            <button onClick={() => toast.info("Import coming soon")}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent/40 transition-colors">
              <Upload className="w-4 h-4" /> Import Owners
            </button>
            <button onClick={() => toast.info("Export coming soon")}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent/40 transition-colors">
              <Download className="w-4 h-4" /> Export to CSV
            </button>
          </>
        )}
        {activeTab === "Vendors" && (
          <>
            <button onClick={onAddVendor}
              className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
            <button onClick={() => toast.info("Import coming soon")}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent/40 transition-colors">
              <Upload className="w-4 h-4" /> Import Vendors
            </button>
            <button onClick={() => toast.info("Export coming soon")}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent/40 transition-colors">
              <Download className="w-4 h-4" /> Export to CSV
            </button>
          </>
        )}
        {activeTab === "Board Members" && (
          <Link href="/invitations">
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Mail className="w-4 h-4" /> Invite Board Member
            </button>
          </Link>
        )}
      </div>

      {/* Quick links */}
      <div className="p-3 border-b border-sidebar-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Reports</p>
        <div className="space-y-1">
          {activeTab === "Owners" && [
            "Owner Statement",
            "Homeowner Delinquency",
            "Owner Ledger",
            "1099 Summary",
          ].map(r => (
            <Link key={r} href="/reports">
              <button className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-left">
                <Star className="w-3 h-3 flex-shrink-0" style={{ color: "#7a5a10" }} />
                {r}
              </button>
            </Link>
          ))}
          {activeTab === "Vendors" && [
            "Vendor Ledger",
            "1099 Vendor List",
            "Vendor Insurance",
            "Compliance Report",
          ].map(r => (
            <Link key={r} href="/reports">
              <button className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-left">
                <Star className="w-3 h-3 flex-shrink-0" style={{ color: "#7a5a10" }} />
                {r}
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-3 flex-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
        <div className="space-y-2">
          {activeTab === "Owners" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Total Owners</span>
                <span className="text-xs font-semibold text-foreground">{ownerCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Active Accounts</span>
                <span className="text-xs font-semibold text-foreground">{ownerCount}</span>
              </div>
            </>
          )}
          {activeTab === "Vendors" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Total Vendors</span>
                <span className="text-xs font-semibold text-foreground">{vendorCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> 1099 Vendors</span>
                <span className="text-xs font-semibold text-foreground">—</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SORT ICON ────────────────────────────────────────────────────────────────
function SortIcon({ field, sortBy, sortDir }: { field: string; sortBy: string; sortDir: "asc" | "desc" }) {
  if (sortBy !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Owners");
  const [search, setSearch] = useState("");
  const [letterFilter, setLetterFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);

  const utils = trpc.useUtils();
  const { data: owners = [] } = trpc.owners.list.useQuery({ search });
  const { data: vendors = [] } = trpc.vendors.list.useQuery({ search });

  // Apply letter filter + sort
  const filteredOwners = useMemo(() => {
    let rows = [...(owners as any[])];
    if (letterFilter !== "All") {
      rows = rows.filter(r => {
        const name = r.lastName ?? r.firstName ?? "";
        return name.toUpperCase().startsWith(letterFilter);
      });
    }
    rows.sort((a, b) => {
      let av = "", bv = "";
      if (sortBy === "name") { av = `${a.lastName ?? ""} ${a.firstName ?? ""}`.trim(); bv = `${b.lastName ?? ""} ${b.firstName ?? ""}`.trim(); }
      else if (sortBy === "email") { av = a.email ?? ""; bv = b.email ?? ""; }
      else if (sortBy === "phone") { av = a.phone ?? ""; bv = b.phone ?? ""; }
      else if (sortBy === "company") { av = a.propertyId?.toString() ?? ""; bv = b.propertyId?.toString() ?? ""; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [owners, letterFilter, sortBy, sortDir]);

  const filteredVendors = useMemo(() => {
    let rows = [...(vendors as any[])];
    if (letterFilter !== "All") {
      rows = rows.filter(r => (r.companyName ?? "").toUpperCase().startsWith(letterFilter));
    }
    rows.sort((a, b) => {
      let av = "", bv = "";
      if (sortBy === "name") { av = a.companyName ?? ""; bv = b.companyName ?? ""; }
      else if (sortBy === "email") { av = a.email ?? ""; bv = b.email ?? ""; }
      else if (sortBy === "phone") { av = a.phone ?? ""; bv = b.phone ?? ""; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [vendors, letterFilter, sortBy, sortDir]);

  const rows = activeTab === "Owners" ? filteredOwners : activeTab === "Vendors" ? filteredVendors : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field: string) {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
    setPage(1);
  }

  function handleLetterFilter(l: string) {
    setLetterFilter(l);
    setPage(1);
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setLetterFilter("All");
    setSearch("");
    setPage(1);
    setSortBy("name");
    setSortDir("asc");
  }

  const rightPane = (
    <PeopleRightPane
      activeTab={activeTab}
      onAddOwner={() => setShowAddOwner(true)}
      onAddVendor={() => setShowAddVendor(true)}
      ownerCount={(owners as any[]).length}
      vendorCount={(vendors as any[]).length}
    />
  );

  return (
    <>
      {showAddOwner && (
        <AddOwnerModal onClose={() => setShowAddOwner(false)} onSuccess={() => utils.owners.list.invalidate()} />
      )}
      {showAddVendor && (
        <AddVendorModal onClose={() => setShowAddVendor(false)} onSuccess={() => utils.vendors.list.invalidate()} />
      )}

      <ThreePanelLayout
        title="People"
        subtitle="Owners, vendors, and board members"
        rightPanelContent={rightPane}
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          {TABS.map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); setLetterFilter("All"); }}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* A–Z letter filter */}
        <div className="flex flex-wrap gap-0.5 mb-4">
          {ALPHABET.map(l => (
            <button key={l} onClick={() => handleLetterFilter(l)}
              className={`px-2 py-0.5 text-xs rounded transition-colors font-medium ${
                letterFilter === l
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {activeTab === "Owners" ? (
                  <>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Name <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("company")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Company / Association <SortIcon field="company" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("phone")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Phone <SortIcon field="phone" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("email")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Email <SortIcon field="email" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                  </>
                ) : activeTab === "Vendors" ? (
                  <>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Firm <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trades</th>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("phone")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Phone <SortIcon field="phone" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <button onClick={() => toggleSort("email")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        Email <SortIcon field="email" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedRows.length > 0 ? pagedRows.map((r: any) => (
                <tr key={r.id} className="table-row-hover cursor-pointer">
                  {activeTab === "Owners" ? (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                            {(r.lastName?.[0] ?? r.firstName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-primary hover:underline">
                            {r.firstName} {r.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.unit ? `Unit ${r.unit}` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.email ? <a href={`mailto:${r.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{r.email}</a> : "—"}
                      </td>
                    </>
                  ) : activeTab === "Vendors" ? (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                            {(r.companyName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-primary hover:underline">{r.companyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.address ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.contactName ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.email ? <a href={`mailto:${r.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{r.email}</a> : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{r.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.phone ?? "—"}</td>
                    </>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {search || letterFilter !== "All"
                      ? `No ${activeTab.toLowerCase()} match your filter.`
                      : <>No {activeTab.toLowerCase()} yet.{" "}
                          {activeTab !== "Board Members" && (
                            <button onClick={activeTab === "Owners" ? () => setShowAddOwner(true) : () => setShowAddVendor(true)}
                              className="text-primary hover:underline">Add one now.</button>
                          )}</>
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-accent/40 disabled:opacity-40 transition-colors">‹ Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs border rounded transition-colors ${page === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent/40"}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-accent/40 disabled:opacity-40 transition-colors">Next ›</button>
            </div>
          </div>
        )}
      </ThreePanelLayout>
    </>
  );
}
