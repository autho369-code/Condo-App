"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewMeetingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [associations, setAssociations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    meeting_type: "board_meeting",
    association_id: "",
    start_time: "",
    end_time: "",
    location: "",
    agenda: "",
    quorum_requirement: 0,
  });

  useEffect(() => {
    supabase
      .from("associations")
      .select("id, name, unit_count, quorum_percentage")
      .order("name")
      .then(({ data }: any) => {
        if (data) setAssociations(data);
      });
  }, [supabase]);

  function handleAssociationChange(assocId: string) {
    const assoc = associations.find((a: any) => a.id === assocId);
    const pct = assoc?.quorum_percentage || 51;
    const units = assoc?.unit_count || 0;
    const needed = Math.ceil(units * pct / 100);
    setForm((f: any) => ({
      ...f,
      association_id: assocId,
      quorum_requirement: needed,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (!form.title || !form.association_id || !form.start_time) {
      setError("Title, association, and start time are required.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("meetings")
      .insert({
        title: form.title,
        meetingType: form.meeting_type,
        association_id: form.association_id,
        scheduledAt: form.start_time ? new Date(form.start_time).toISOString() : null,
        location: form.location || null,
        agenda: form.agenda || null,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push(`/meetings/${data.id}`);
  }

  function setField(field: string, value: string | number) {
    setForm((f: any) => ({ ...f, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-[#060B18] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-light tracking-tight mb-6">Schedule Meeting</h1>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Meeting Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Q2 Board Meeting"
              className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          {/* Type + Association */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Meeting Type</label>
              <select
                value={form.meeting_type}
                onChange={(e) => setField("meeting_type", e.target.value)}
                className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="board_meeting">Board Meeting</option>
                <option value="annual_meeting">Annual Meeting</option>
                <option value="special_meeting">Special Meeting</option>
                <option value="committee_meeting">Committee Meeting</option>
                <option value="executive_session">Executive Session</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Association *</label>
              <select
                value={form.association_id}
                onChange={(e) => handleAssociationChange(e.target.value)}
                className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                required
              >
                <option value="">Select association...</option>
                {associations.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Time *</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setField("start_time", e.target.value)}
                className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">End Time</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setField("end_time", e.target.value)}
                className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="e.g. Clubhouse, Virtual (Zoom link)"
              className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Quorum Requirement */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Quorum Requirement ({associations.find((a: any) => a.id === form.association_id)?.quorum_percentage || 51}% of {associations.find((a: any) => a.id === form.association_id)?.unit_count || '—'} units)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={form.quorum_requirement}
                onChange={(e) => setField("quorum_requirement", parseInt(e.target.value) || 0)}
                min={0}
                className="w-32 bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              <span className="text-sm text-slate-500">attendees needed</span>
            </div>
          </div>

          {/* Agenda */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Agenda</label>
            <textarea
              value={form.agenda}
              onChange={(e) => setField("agenda", e.target.value)}
              rows={5}
              placeholder="Meeting agenda items..."
              className="w-full bg-[#060B18] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Scheduling..." : "Schedule Meeting"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
