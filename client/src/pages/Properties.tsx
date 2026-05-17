import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Plus, MapPin, Home, FolderOpen, Upload, FileText,
  Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Shield, BookOpen,
  ReceiptText, FileCheck, Wrench, AlertTriangle, Loader2, Users
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Document category config ─────────────────────────────────────────────────
const DOC_CATEGORY_OPTIONS = [
  { value: "governing_document", label: "Governing Document",  icon: <Shield className="w-4 h-4" /> },
  { value: "meeting_minutes",    label: "Meeting Minutes",     icon: <BookOpen className="w-4 h-4" /> },
  { value: "financial_report",   label: "Financial Report",    icon: <ReceiptText className="w-4 h-4" /> },
  { value: "insurance",          label: "Insurance",           icon: <FileCheck className="w-4 h-4" /> },
  { value: "maintenance_record", label: "Maintenance Record",  icon: <Wrench className="w-4 h-4" /> },
  { value: "notice",             label: "Notice",              icon: <AlertTriangle className="w-4 h-4" /> },
  { value: "other",              label: "Other",               icon: <FileText className="w-4 h-4" /> },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Document Upload Dialog ───────────────────────────────────────────────────
function DocumentUploadDialog({
  propertyId,
  onUploaded,
}: {
  propertyId: number;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other",
    isSharedWithOwners: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Please select a file"); return; }
    if (!form.title.trim()) { toast.error("Please enter a title"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      fd.append("isSharedWithOwners", String(form.isSharedWithOwners));

      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      setForm({ title: "", description: "", category: "other", isSharedWithOwners: false });
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-olive text-cream hover:bg-olive/90">
          <Upload className="w-4 h-4 mr-2" /> Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Upload Property Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Document Title *</Label>
            <Input
              placeholder="e.g. Declaration of Condominium 2024"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">{opt.icon} {opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Brief description of this document..."
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="resize-none"
            />
          </div>
          <div>
            <Label>File *</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png"
              className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-olive/10 file:text-olive hover:file:bg-olive/20 cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, PowerPoint, images — max 25 MB</p>
          </div>
          <div className="flex items-center justify-between bg-muted/40 rounded-xl p-3">
            <div>
              <p className="text-sm font-medium text-charcoal flex items-center gap-2">
                <Users className="w-4 h-4 text-olive" />
                Share with Owners
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Owners will see this in their portal</p>
            </div>
            <Switch
              checked={form.isSharedWithOwners}
              onCheckedChange={v => setForm(f => ({ ...f, isSharedWithOwners: v }))}
            />
          </div>
          <Button
            className="w-full bg-olive text-cream hover:bg-olive/90"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Upload Document</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Property Documents Panel ─────────────────────────────────────────────────
function PropertyDocumentsPanel({ propertyId }: { propertyId: number }) {
  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.listByProperty.useQuery({ propertyId });

  const toggleShare = trpc.documents.toggleShare.useMutation({
    onSuccess: () => utils.documents.listByProperty.invalidate({ propertyId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      utils.documents.listByProperty.invalidate({ propertyId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-olive" />
      </div>
    );
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No documents yet. Upload the first one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => {
        const catOpt = DOC_CATEGORY_OPTIONS.find(o => o.value === doc.category) ?? DOC_CATEGORY_OPTIONS[DOC_CATEGORY_OPTIONS.length - 1];
        return (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-olive/10 flex items-center justify-center shrink-0 text-olive">
              {catOpt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{catOpt.label}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Share toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {doc.isSharedWithOwners ? "Shared" : "Private"}
              </span>
              <Switch
                checked={doc.isSharedWithOwners ?? false}
                onCheckedChange={(v) => toggleShare.mutate({ documentId: doc.id, isShared: v })}
                title={doc.isSharedWithOwners ? "Click to make private" : "Click to share with owners"}
              />
              {doc.isSharedWithOwners ? (
                <Eye className="w-3.5 h-3.5 text-olive" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>

            {/* Download */}
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-charcoal"
              title="Download"
            >
              <FileText className="w-4 h-4" />
            </a>

            {/* Delete */}
            <button
              onClick={() => {
                if (confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
                  deleteDoc.mutate({ documentId: doc.id });
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
              title="Delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Property Card with Documents ─────────────────────────────────────────────
function PropertyCard({ property }: { property: any }) {
  const [docsOpen, setDocsOpen] = useState(false);
  const utils = trpc.useUtils();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-olive/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-olive" />
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {(property.propertyType ?? "condominium").replace(/_/g, " ")}
          </Badge>
        </div>
        <h3 className="font-serif font-semibold text-charcoal mb-1">{property.name}</h3>
        {(property.address || property.city) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{[property.address, property.city, property.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {property.unitCount && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Home className="w-3 h-3" />{property.unitCount} units
          </div>
        )}

        {/* Documents toggle */}
        <button
          onClick={() => setDocsOpen(v => !v)}
          className="w-full flex items-center justify-between text-xs font-medium text-olive hover:text-olive/80 transition-colors mt-2 pt-2 border-t border-border"
        >
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            Property Documents
          </span>
          {docsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </CardContent>

      <AnimatePresence>
        {docsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-charcoal uppercase tracking-wider">Documents</p>
                <DocumentUploadDialog
                  propertyId={property.id}
                  onUploaded={() => utils.documents.listByProperty.invalidate({ propertyId: property.id })}
                />
              </div>
              <PropertyDocumentsPanel propertyId={property.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Main Properties Page ─────────────────────────────────────────────────────
export default function Properties() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", zip: "", unitCount: "", propertyType: "condominium"
  });

  const utils = trpc.useUtils();
  const { data: properties, isLoading } = trpc.company.properties.useQuery();

  const createProperty = trpc.company.addProperty.useMutation({
    onSuccess: () => {
      toast.success("Property added.");
      utils.company.properties.invalidate();
      setOpen(false);
      setForm({ name: "", address: "", city: "", state: "", zip: "", unitCount: "", propertyType: "condominium" });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Properties</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {properties?.length ?? 0} properties in your portfolio. Click a property to manage its documents.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90">
              <Plus className="w-4 h-4 mr-2" />Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Add Condominium Property</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Property Name *</Label>
                <Input
                  placeholder="e.g. The Meridian at Brickell"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Property Type</Label>
                <Select value={form.propertyType} onValueChange={v => setForm(f => ({ ...f, propertyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="condominium">Condominium</SelectItem>
                    <SelectItem value="hoa">HOA Community</SelectItem>
                    <SelectItem value="coop">Co-op</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Street Address</Label>
                <Input
                  placeholder="123 Ocean Drive"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Label>City</Label>
                  <Input placeholder="Miami" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input placeholder="FL" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input placeholder="33131" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Number of Units</Label>
                <Input
                  type="number"
                  placeholder="120"
                  value={form.unitCount}
                  onChange={e => setForm(f => ({ ...f, unitCount: e.target.value }))}
                />
              </div>
              <Button
                className="w-full bg-olive text-cream"
                onClick={() => createProperty.mutate({
                  ...form,
                  unitCount: form.unitCount ? Number(form.unitCount) : undefined,
                  propertyType: form.propertyType as "condominium" | "hoa" | "coop" | undefined,
                })}
                disabled={createProperty.isPending}
              >
                {createProperty.isPending ? "Adding..." : "Add Property"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Document sharing info banner */}
      <div className="mb-5 bg-olive/5 border border-olive/20 rounded-xl p-4 flex items-start gap-3">
        <FolderOpen className="w-5 h-5 text-olive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-charcoal">Property Document Sharing</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Expand any property card to upload documents (governing docs, meeting minutes, financial reports, etc.)
            and toggle which ones are shared with owners in their portal.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !properties || properties.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No properties yet</p>
          <p className="text-sm mt-1">Add your first condominium property to get started.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
