import { useState } from "react";
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
import { Users, Plus, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

const MEETING_COLORS: Record<string, string> = {
  board_meeting: "bg-emerald-100 text-emerald-700",
  annual_meeting: "bg-blue-100 text-blue-700",
  special_meeting: "bg-purple-100 text-purple-700",
  committee_meeting: "bg-amber-100 text-amber-700",
  vendor_meeting: "bg-orange-100 text-orange-700",
  internal: "bg-gray-100 text-gray-600",
};

export default function Meetings() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", meetingType: "board_meeting", scheduledAt: "", location: "", agenda: "" });
  const [minutesOpen, setMinutesOpen] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("");
  const [summary, setSummary] = useState("");

  const utils = trpc.useUtils();
  const { data: properties } = trpc.company.properties.useQuery();
  const [selectedProperty, setSelectedProperty] = useState<number | undefined>();
  const propId = selectedProperty ?? properties?.[0]?.id;
  const { data: meetings, isLoading } = trpc.meetings.list.useQuery({ propertyId: propId ?? 0 }, { enabled: !!propId });

  const createMeeting = trpc.meetings.create.useMutation({
    onSuccess: () => {
      toast.success("Meeting scheduled.");
      utils.meetings.list.invalidate();
      setOpen(false);
      setForm({ title: "", meetingType: "board_meeting", scheduledAt: "", location: "", agenda: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMinutes = trpc.meetings.saveMinutes.useMutation({
    onSuccess: () => { toast.success("Minutes saved."); utils.meetings.list.invalidate(); },
  });

  const generateSummary = trpc.meetings.generateSummary.useMutation({
    onSuccess: (data) => { setSummary(data.summary); toast.success("AI summary generated."); },
    onError: () => toast.error("Could not generate summary."),
  });

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!propId) return toast.error("No property available.");
    createMeeting.mutate({
      ...form,
      propertyId: propId,
      meetingType: form.meetingType as any,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt) : undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Meetings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Board meetings, annual meetings, and committee sessions.</p>
        </div>
        <div className="flex gap-3">
          {properties && properties.length > 1 && (
            <Select value={selectedProperty ? String(selectedProperty) : "all"} onValueChange={v => setSelectedProperty(v === "all" ? undefined : Number(v))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Select Property" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />New Meeting</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif">Schedule Meeting</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div><Label>Title *</Label><Input placeholder="e.g. Q2 Board Meeting" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div>
                  <Label>Meeting Type</Label>
                  <Select value={form.meetingType} onValueChange={v => setForm(f => ({ ...f, meetingType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(MEETING_COLORS).map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g," ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date & Time</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
                  <div><Label>Location</Label><Input placeholder="Lobby / Zoom" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                </div>
                <div><Label>Agenda</Label><Textarea placeholder="1. Call to order&#10;2. Financial review&#10;3. Maintenance updates" value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} rows={4} /></div>
                <Button className="w-full bg-olive text-cream" onClick={handleCreate} disabled={createMeeting.isPending}>
                  {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !meetings || meetings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No meetings yet</p>
          <p className="text-sm mt-1">Schedule your first board meeting.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map(m => (
            <Card key={m.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-base font-semibold text-charcoal">{m.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-xs ${MEETING_COLORS[m.meetingType ?? "internal"]}`}>{(m.meetingType ?? "internal").replace(/_/g," ")}</Badge>
                      {m.scheduledAt && <span className="text-xs text-muted-foreground">{new Date(m.scheduledAt).toLocaleString()}</span>}
                      {m.location && <span className="text-xs text-muted-foreground">📍 {m.location}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => { setMinutesOpen(m.id); setMinutes(m.minutes ?? ""); setSummary(m.aiSummary ?? ""); }}>
                      <FileText className="w-3.5 h-3.5 mr-1" />Minutes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {m.agenda && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Agenda</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{m.agenda}</p>
                </CardContent>
              )}
              {minutesOpen === m.id && (
                <CardContent className="pt-0 border-t border-border mt-2">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Meeting Minutes</Label>
                      <Textarea value={minutes} onChange={e => setMinutes(e.target.value)} rows={5} placeholder="Record what was discussed and decided..." className="text-sm mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-olive text-cream text-xs" onClick={() => saveMinutes.mutate({ meetingId: m.id, minutes })} disabled={saveMinutes.isPending}>
                        {saveMinutes.isPending ? "Saving..." : "Save Minutes"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs border-olive/30 text-olive hover:bg-olive/10"
                        onClick={() => generateSummary.mutate({ meetingId: m.id, agenda: m.agenda ?? "", minutes })} disabled={generateSummary.isPending}>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />{generateSummary.isPending ? "Generating..." : "AI Summary"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => { setMinutesOpen(null); setSummary(""); }}>Close</Button>
                    </div>
                    {summary && (
                      <div className="bg-olive/5 border border-olive/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-olive mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI Summary</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{summary}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
