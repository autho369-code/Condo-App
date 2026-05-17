import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Ticket, Plus, Search, Filter, Paperclip, Upload, X, FileText,
  Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Eye, ZoomIn,
  LayoutList, Columns
} from "lucide-react";
import KanbanBoard, { type TicketStatus as KanbanStatus } from "@/components/KanbanBoard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  pending_vendor: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingFile {
  file: File;
  preview: string | null; // data URL for images
  id: string;
}

interface UploadState {
  progress: number; // 0-100
  uploading: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (isImage(mimeType)) return <ImageIcon className={className ?? "w-4 h-4"} />;
  return <FileText className={className ?? "w-4 h-4"} />;
}

// ─── Attachment Panel (per ticket) ───────────────────────────────────────────
function AttachmentPanel({ ticketId }: { ticketId: number }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ progress: 0, uploading: false, error: null });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: attachments, isLoading } = trpc.tickets.listAttachments.useQuery({ ticketId });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const deleteAttachment = trpc.tickets.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.tickets.listAttachments.invalidate({ ticketId });
      toast.success("Attachment removed.");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    // Validate
    for (const f of fileArr) {
      if (!ALLOWED_TYPES.has(f.type)) {
        toast.error(`File type not allowed: ${f.name}`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10 MB limit.`);
        return;
      }
    }
    const currentCount = attachments?.length ?? 0;
    if (currentCount + fileArr.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} attachments per ticket.`);
      return;
    }

    setUploadState({ progress: 10, uploading: true, error: null });

    const formData = new FormData();
    fileArr.forEach(f => formData.append("files", f));

    try {
      // Simulate progress increments while uploading
      const progressInterval = setInterval(() => {
        setUploadState(s => ({ ...s, progress: Math.min(s.progress + 15, 85) }));
      }, 300);

      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      setUploadState({ progress: 100, uploading: false, error: null });
      toast.success(`${fileArr.length} file${fileArr.length > 1 ? "s" : ""} uploaded.`);
      utils.tickets.listAttachments.invalidate({ ticketId });

      setTimeout(() => setUploadState({ progress: 0, uploading: false, error: null }), 800);
    } catch (err: any) {
      setUploadState({ progress: 0, uploading: false, error: err.message });
      toast.error(err.message ?? "Upload failed");
    }
  }, [attachments, ticketId, utils]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Attachments {attachments && attachments.length > 0 && `(${attachments.length}/${MAX_FILES})`}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState.uploading || (attachments?.length ?? 0) >= MAX_FILES}
        >
          <Upload className="w-3 h-3 mr-1" />
          {uploadState.uploading ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Array.from(ALLOWED_TYPES).join(",")}
          className="hidden"
          onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Upload progress bar */}
      {uploadState.uploading && (
        <div className="mb-3">
          <Progress value={uploadState.progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">Uploading... {uploadState.progress}%</p>
        </div>
      )}

      {/* Drop zone */}
      {(attachments?.length ?? 0) < MAX_FILES && (
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground cursor-pointer transition-colors mb-3 ${
            dragOver ? "border-olive bg-olive/5" : "border-muted hover:border-olive/50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mx-auto mb-1 opacity-50" />
          Drop photos or documents here, or click to browse
          <br />
          <span className="opacity-60">JPG, PNG, PDF, DOCX, XLSX — max 10 MB each</span>
        </div>
      )}

      {/* Attachment list */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group">
              <FileIcon mimeType={att.mimeType} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-charcoal truncate">{att.fileName}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(att.fileSize)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isImage(att.mimeType) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setLightboxUrl(att.fileUrl)}
                    title="Preview image"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </Button>
                )}
                <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Open file">
                    <Eye className="w-3 h-3" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  disabled={deletingId === att.id}
                  onClick={() => setConfirmDeleteId(att.id)}
                  title="Delete attachment"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No attachments yet.</p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (confirmDeleteId === null) return;
                setDeletingId(confirmDeleteId);
                deleteAttachment.mutate(
                  { attachmentId: confirmDeleteId, ticketId },
                  { onSettled: () => { setDeletingId(null); setConfirmDeleteId(null); } }
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-10 right-0 text-white hover:text-white/70"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="w-5 h-5 mr-1" /> Close
            </Button>
            <img
              src={lightboxUrl}
              alt="Attachment preview"
              className="rounded-lg max-w-full max-h-[85vh] object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tickets Page ────────────────────────────────────────────────────────
export default function Tickets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try { return (localStorage.getItem("tickets_view") as "list" | "kanban") ?? "list"; }
    catch { return "list"; }
  });
  const [open, setOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", unitNumber: "" });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [createdTicketId, setCreatedTicketId] = useState<number | null>(null);
  const [uploadingAfterCreate, setUploadingAfterCreate] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: properties } = trpc.company.properties.useQuery();
  const [selectedProperty, setSelectedProperty] = useState<number | undefined>();
  const { data: tickets, isLoading } = trpc.tickets.list.useQuery({ propertyId: selectedProperty });

  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: async (result) => {
      const newTicketId = (result as any)?.id;
      if (newTicketId && pendingFiles.length > 0) {
        // Upload pending files to the newly created ticket
        setUploadingAfterCreate(true);
        const formData = new FormData();
        pendingFiles.forEach(pf => formData.append("files", pf.file));
        try {
          const res = await fetch(`/api/tickets/${newTicketId}/attachments`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!res.ok) throw new Error("Attachment upload failed");
          toast.success("Ticket created with attachments.");
        } catch {
          toast.warning("Ticket created, but some attachments failed to upload.");
        } finally {
          setUploadingAfterCreate(false);
        }
      } else {
        toast.success("Ticket created — AI is classifying it now.");
      }
      utils.tickets.list.invalidate();
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", unitNumber: "" });
      setPendingFiles([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => { utils.tickets.list.invalidate(); toast.success("Status updated."); },
  });

  const handleViewChange = (mode: "list" | "kanban") => {
    setViewMode(mode);
    try { localStorage.setItem("tickets_view", mode); } catch {}
  };

  const handleKanbanStatusChange = (ticketId: number, newStatus: KanbanStatus) => {
    updateStatus.mutate({ ticketId, status: newStatus });
  };

  const filtered = (tickets ?? []).filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!selectedProperty && properties && properties.length > 0) {
      toast.error("Please select a property.");
      return;
    }
    const propertyId = selectedProperty ?? properties?.[0]?.id;
    if (!propertyId) return toast.error("No property available.");
    createTicket.mutate({ ...form, propertyId, priority: form.priority as any });
  };

  const addPendingFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const valid: PendingFile[] = [];
    for (const f of fileArr) {
      if (!ALLOWED_TYPES.has(f.type)) { toast.error(`Not allowed: ${f.name}`); continue; }
      if (f.size > MAX_FILE_SIZE) { toast.error(`Too large: ${f.name}`); continue; }
      const preview = f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : null;
      valid.push({ file: f, preview, id: `${f.name}-${f.size}-${Date.now()}` });
    }
    setPendingFiles(prev => {
      const combined = [...prev, ...valid];
      return combined.slice(0, MAX_FILES);
    });
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Work Tickets</h1>
          <p className="text-muted-foreground mt-1 text-sm">AI-classified tickets from all sources.</p>
        </div>
        <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewChange("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-olive text-cream"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => handleViewChange("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "kanban"
                    ? "bg-olive text-cream"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPendingFiles([]); }}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90">
              <Plus className="w-4 h-4 mr-2" />New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Create Work Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {properties && properties.length > 1 && (
                <div>
                  <Label>Property</Label>
                  <Select onValueChange={v => setSelectedProperty(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Title *</Label>
                <Input
                  placeholder="e.g. Lobby elevator not working"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the issue in detail..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high", "urgent"].map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit # (optional)</Label>
                  <Input
                    placeholder="e.g. 4B"
                    value={form.unitNumber}
                    onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* ── Attachment dropzone in create form ── */}
              <div>
                <Label className="flex items-center gap-1.5 mb-2">
                  <Paperclip className="w-3.5 h-3.5" />
                  Attachments (optional)
                </Label>
                <div
                  className="border-2 border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground cursor-pointer hover:border-olive/50 transition-colors"
                  onClick={() => createFileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) addPendingFiles(e.dataTransfer.files); }}
                >
                  <Upload className="w-4 h-4 mx-auto mb-1 opacity-50" />
                  Drop photos or documents here, or click to browse
                  <br />
                  <span className="opacity-60">Up to {MAX_FILES} files · 10 MB each · JPG, PNG, PDF, DOCX, XLSX</span>
                </div>
                <input
                  ref={createFileInputRef}
                  type="file"
                  multiple
                  accept={Array.from(ALLOWED_TYPES).join(",")}
                  className="hidden"
                  onChange={e => { if (e.target.files) addPendingFiles(e.target.files); e.target.value = ""; }}
                />

                {/* Pending file previews */}
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {pendingFiles.map(pf => (
                      <div key={pf.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/40">
                        {pf.preview ? (
                          <img src={pf.preview} alt={pf.file.name} className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{pf.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(pf.file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removePendingFile(pf.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                AI will automatically classify the category based on the title and description.
              </p>
              <Button
                className="w-full bg-olive text-cream"
                onClick={handleCreate}
                disabled={createTicket.isPending || uploadingAfterCreate}
              >
                {uploadingAfterCreate
                  ? "Uploading attachments..."
                  : createTicket.isPending
                  ? "Creating..."
                  : `Create Ticket${pendingFiles.length > 0 ? ` + ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}` : ""}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
          </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["open", "in_progress", "pending_vendor", "resolved", "closed"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {properties && properties.length > 1 && (
          <Select
            value={selectedProperty ? String(selectedProperty) : "all"}
            onValueChange={v => setSelectedProperty(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger className="w-44"><SelectValue placeholder="All Properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Ticket List / Kanban */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tickets={(tickets ?? []).map(t => ({
            id: t.id,
            title: t.title,
            status: t.status as KanbanStatus | null,
            priority: t.priority,
            category: t.category,
            unitNumber: t.unitNumber,
            createdAt: t.createdAt,
          }))}
          onStatusChange={handleKanbanStatusChange}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">Create your first ticket to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const isExpanded = expandedTicketId === t.id;
            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-charcoal text-sm">{t.title}</span>
                        {t.unitNumber && (
                          <Badge variant="outline" className="text-xs">Unit {t.unitNumber}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${STATUS_COLORS[t.status ?? "open"]}`}>
                          {(t.status ?? "open").replace(/_/g, " ")}
                        </Badge>
                        <Badge className={`text-xs ${PRIORITY_COLORS[t.priority ?? "medium"]}`}>
                          {t.priority}
                        </Badge>
                        {t.category && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {t.category.replace(/_/g, " ")}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select
                        value={t.status ?? "open"}
                        onValueChange={v => updateStatus.mutate({ ticketId: t.id, status: v as any })}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["open", "in_progress", "pending_vendor", "resolved", "closed"].map(s => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Expand/collapse attachment panel */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title={isExpanded ? "Hide attachments" : "Show attachments"}
                        onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                      >
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4" />
                          : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  {/* Attachment panel — lazy loaded when expanded */}
                  {isExpanded && <AttachmentPanel ticketId={t.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
