import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Plus, Sparkles, CheckCheck, Search } from "lucide-react";
import { toast } from "sonner";

export default function EmailHub() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", fromAddress: "", toAddresses: "", fullBody: "" });
  const [draftOpen, setDraftOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const utils = trpc.useUtils();
  const { data: emails, isLoading } = trpc.email.list.useQuery();

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

  const filtered = (emails ?? []).filter(e =>
    !search || (e.subject ?? "").toLowerCase().includes(search.toLowerCase()) || (e.fromAddress ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const unread = filtered.filter(e => !e.isRead).length;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Email Hub</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {unread > 0 ? <span className="text-olive font-medium">{unread} unread</span> : "All caught up"} · {filtered.length} total threads
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />Log Email</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Log Email Thread</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Subject</Label><Input placeholder="Re: Roof leak in unit 12A" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div><Label>From</Label><Input placeholder="resident@example.com" value={form.fromAddress} onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))} /></div>
              <div><Label>To</Label><Input placeholder="manager@yourcompany.com" value={form.toAddresses} onChange={e => setForm(f => ({ ...f, toAddresses: e.target.value }))} /></div>
              <div><Label>Body</Label><Textarea placeholder="Email content..." value={form.fullBody} onChange={e => setForm(f => ({ ...f, fullBody: e.target.value }))} rows={4} /></div>
              <Button className="w-full bg-olive text-cream" onClick={() => addEmail.mutate({ ...form, source: "manual", bodyPreview: form.fullBody.slice(0, 200) })} disabled={addEmail.isPending}>
                {addEmail.isPending ? "Logging..." : "Log Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by subject or sender..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No emails yet</p>
          <p className="text-sm mt-1">Log your first email thread or connect Gmail / Outlook.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <Card key={e.id} className={`hover:shadow-sm transition-shadow ${!e.isRead ? "border-olive/40 bg-olive/5" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!e.isRead && <div className="w-2 h-2 rounded-full bg-olive flex-shrink-0" />}
                      <p className={`text-sm truncate ${!e.isRead ? "font-semibold text-charcoal" : "font-medium text-charcoal"}`}>{e.subject ?? "(No subject)"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.fromAddress ?? "Unknown sender"} · {new Date(e.receivedAt).toLocaleDateString()}</p>
                    {e.bodyPreview && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.bodyPreview}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!e.isRead && (
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => markRead.mutate({ emailId: e.id })}>
                        <CheckCheck className="w-3.5 h-3.5 mr-1" />Read
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-olive/30 text-olive hover:bg-olive/10"
                      onClick={() => { setDraftOpen(e.id); draftReply.mutate({ subject: e.subject ?? "", body: e.fullBody ?? e.bodyPreview ?? "" }); }}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" />AI Reply
                    </Button>
                  </div>
                </div>
                {draftOpen === e.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {draftReply.isPending ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="w-4 h-4 animate-pulse text-olive" />Generating draft...</div>
                    ) : draft ? (
                      <div>
                        <p className="text-xs font-semibold text-olive mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI Draft Reply</p>
                        <Textarea value={draft} onChange={ev => setDraft(ev.target.value)} rows={4} className="text-sm" />
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="bg-olive text-cream text-xs" onClick={() => { navigator.clipboard.writeText(draft); toast.success("Copied to clipboard."); }}>Copy</Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setDraftOpen(null); setDraft(""); }}>Dismiss</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
