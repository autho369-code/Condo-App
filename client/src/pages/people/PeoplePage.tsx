import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Search, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TABS = ["Owners", "Vendors", "Board Members"];

// ─── ADD OWNER MODAL ──────────────────────────────────────────────────────────
function AddOwnerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: properties } = trpc.properties.list.useQuery();
  const createOwner = trpc.owners.create.useMutation({
    onSuccess: () => {
      toast.success("Owner added successfully");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    propertyId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    unit: "",
  });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Owner</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Association *</label>
            <select
              value={form.propertyId}
              onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select association...</option>
              {(properties ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Smith"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="john@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="(555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="101"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOwner.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
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
    onSuccess: () => {
      toast.success("Vendor added successfully");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    paymentType: "check" as "check" | "ach" | "online" | "credit_card",
    w9OnFile: false,
    is1099Vendor: false,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Vendor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name *</label>
            <input
              type="text"
              value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="ABC Landscaping"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Name</label>
            <input
              type="text"
              value={form.contactName}
              onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Jane Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="vendor@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="(555) 000-0000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Type</label>
            <select
              value={form.paymentType}
              onChange={e => setForm(f => ({ ...f, paymentType: e.target.value as any }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="check">Check</option>
              <option value="ach">ACH</option>
              <option value="online">Online</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.w9OnFile}
                onChange={e => setForm(f => ({ ...f, w9OnFile: e.target.checked }))}
                className="rounded border-border"
              />
              W-9 on file
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is1099Vendor}
                onChange={e => setForm(f => ({ ...f, is1099Vendor: e.target.checked }))}
                className="rounded border-border"
              />
              1099 Vendor
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVendor.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createVendor.isPending ? "Saving..." : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState("Owners");
  const [search, setSearch] = useState("");
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);

  const utils = trpc.useUtils();
  const { data: owners } = trpc.owners.list.useQuery({ search });
  const { data: vendors } = trpc.vendors.list.useQuery({ search });

  const rows = activeTab === "Owners" ? (owners ?? []) : (vendors ?? []);

  function handleAddClick() {
    if (activeTab === "Owners") setShowAddOwner(true);
    else if (activeTab === "Vendors") setShowAddVendor(true);
  }

  return (
    <>
      {showAddOwner && (
        <AddOwnerModal
          onClose={() => setShowAddOwner(false)}
          onSuccess={() => utils.owners.list.invalidate()}
        />
      )}
      {showAddVendor && (
        <AddVendorModal
          onClose={() => setShowAddVendor(false)}
          onSuccess={() => utils.vendors.list.invalidate()}
        />
      )}

      <ThreePanelLayout
        title="People"
        subtitle="Owners, vendors, and board members"
        actions={
          activeTab !== "Board Members" ? (
            <button
              onClick={handleAddClick}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add {activeTab === "Owners" ? "Owner" : "Vendor"}
            </button>
          ) : undefined
        }
      >
        <div className="flex gap-1 mb-4 border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length > 0 ? rows.map((r: any) => (
                <tr key={r.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(r.firstName?.[0] ?? r.companyName?.[0] ?? "?").toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {r.firstName ? `${r.firstName} ${r.lastName ?? ""}` : r.companyName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive !== false ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {r.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No {activeTab.toLowerCase()} found.{" "}
                    {activeTab !== "Board Members" && (
                      <button onClick={handleAddClick} className="text-primary hover:underline">
                        Add one now.
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ThreePanelLayout>
    </>
  );
}
