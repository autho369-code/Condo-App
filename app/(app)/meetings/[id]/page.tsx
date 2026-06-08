"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MEETING_TYPE_LABELS: Record<string, string> = {
  board_meeting: "Board Meeting",
  annual_meeting: "Annual Meeting",
  special_meeting: "Special Meeting",
  committee_meeting: "Committee Meeting",
  executive_session: "Executive Session",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-emerald-100 text-emerald-800",
  completed: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

// ========== Signature Pad Component ==========
function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDraw() {
    isDrawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <label className="block text-sm font-semibold text-gray-700 mb-3">Digital Signature</label>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="border-2 border-dashed border-gray-300 rounded-lg w-full bg-gray-50 cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <p className="text-xs text-gray-400 mt-1.5">Sign above using mouse or touch</p>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={!hasSignature}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Save Signature
        </button>
        <button onClick={clearSignature} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          Clear
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 ml-auto">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ========== Add Attendee Form ==========
function AddAttendeeForm({ meetingId, owners, onAdded }: { meetingId: string; owners: any[]; onAdded: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    attendee_name: "",
    owner_id: "",
    attendee_role: "owner",
    voting_eligible: true,
    notes: "",
  });
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(withSignature: string | null = null) {
    setError("");
    setSaving(true);

    if (!form.attendee_name) {
      setError("Name is required.");
      setSaving(false);
      return;
    }

    const { error: rpcError } = await (supabase as any).rpc("record_meeting_attendance", {
      p_meeting_id: meetingId,
      p_attendee_name: form.attendee_name,
      p_owner_id: form.owner_id || null,
      p_attendee_role: form.attendee_role,
      p_signature_data: withSignature,
      p_voting_eligible: form.voting_eligible,
      p_notes: form.notes || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setForm({ attendee_name: "", owner_id: "", attendee_role: "owner", voting_eligible: true, notes: "" });
      setShowSignature(false);
      onAdded();
    }
    setSaving(false);
  }

  function handleSignatureSave(dataUrl: string) {
    handleAdd(dataUrl);
  }

  if (showSignature) {
    return (
      <SignaturePad
        onSave={handleSignatureSave}
        onCancel={() => setShowSignature(false)}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Attendee</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
          <input
            type="text"
            value={form.attendee_name}
            onChange={(e) => setForm((f: any) => ({ ...f, attendee_name: e.target.value }))}
            placeholder="Full name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
          <select
            value={form.attendee_role}
            onChange={(e) => setForm((f: any) => ({ ...f, attendee_role: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="board_member">Board Member</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="guest">Guest</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Link Owner</label>
          <select
            value={form.owner_id}
            onChange={(e) => setForm((f: any) => ({ ...f, owner_id: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">Guest / Unlinked</option>
            {owners.map((o: any) => (
              <option key={o.id} value={o.id}>{o.full_name || o.name || o.email}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3 pb-0.5">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={form.voting_eligible}
              onChange={(e) => setForm((f: any) => ({ ...f, voting_eligible: e.target.checked }))}
              className="rounded"
            />
            Voting eligible
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAdd(null)}
          disabled={saving || !form.attendee_name}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Adding..." : "Add Without Signature"}
        </button>
        <button
          onClick={() => setShowSignature(true)}
          disabled={saving || !form.attendee_name}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add with Signature
        </button>
      </div>
    </div>
  );
}

// ========== Quorum Badge ==========
function QuorumBadge({ meeting }: { meeting: any }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
      <div className="text-3xl font-bold text-blue-700">—</div>
      <div className="text-xs text-blue-600 mt-1">Quorum tracking is managed during the meeting</div>
    </div>
  );
}

// ========== Main Page ==========
export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const supabase = createClient();

  const [meeting, setMeeting] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [quorum, setQuorum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchMeeting = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("meetings")
      .select("*, associations(id, name, quorum_percentage, unit_count)")
      .eq("id", meetingId)
      .single();
    if (data) setMeeting(data);
  }, [supabase, meetingId]);

  const fetchAttendees = useCallback(async () => {
    const { data } = await supabase
      .from("meeting_attendees")
      .select("*, owners(full_name, email)")
      .eq("meeting_id", meetingId)
      .order("check_in_time", { ascending: true });
    if (data) setAttendees(data);
  }, [supabase, meetingId]);

  const fetchQuorum = useCallback(async () => {
    const { data } = await (supabase as any).rpc("calculate_meeting_quorum", {
      p_meeting_id: meetingId,
    });
    if (data) setQuorum(data);
  }, [supabase, meetingId]);

  const fetchOwners = useCallback(async () => {
    if (!meeting?.association_id) return;
    const { data } = await supabase
      .from("owners")
      .select("id, full_name, email")
      .eq("association_id", meeting.association_id)
      .order("full_name");
    if (data) setOwners(data);
  }, [supabase, meeting?.association_id]);

  const refresh = useCallback(() => {
    fetchMeeting();
    fetchAttendees();
    fetchQuorum();
  }, [fetchMeeting, fetchAttendees, fetchQuorum]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMeeting(), fetchAttendees(), fetchQuorum()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (meeting) fetchOwners();
    else fetchOwners();
  }, [meeting]);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    const { error } = await supabase
      .from("meetings")
      .update({ status: newStatus })
      .eq("id", meetingId);

    if (!error) {
      if (newStatus === "in_progress") {
        // Recalculate quorum when starting
        await supabase.rpc("calculate_meeting_quorum", { p_meeting_id: meetingId });
      }
      refresh();
    }
    setUpdating(false);
  }

  async function handleRemoveAttendee(attendeeId: string) {
    await supabase.from("meeting_attendees").update({ present: false }).eq("id", attendeeId);
    refresh();
  }

  async function handleMarkPresent(attendeeId: string) {
    await supabase.from("meeting_attendees").update({ present: true }).eq("id", attendeeId);
    refresh();
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  function formatTime(d: string | null) {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center">
        <div className="text-slate-400">Loading meeting...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-white mb-2">Meeting not found</p>
          <button onClick={() => router.push("/meetings")} className="text-sm text-emerald-400 hover:text-emerald-300">
            Back to meetings
          </button>
        </div>
      </div>
    );
  }

  const isActive = meeting.status === "scheduled" || meeting.status === "in_progress";

  return (
    <div className="min-h-screen bg-[#060B18] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              onClick={() => router.push("/meetings")}
              className="text-sm text-slate-400 hover:text-white mb-2 flex items-center gap-1"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Meetings
            </button>
            <h1 className="text-2xl font-light tracking-tight">{meeting.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {MEETING_TYPE_LABELS[meeting.meetingType]} — {meeting.associations?.name}
            </p>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[meeting.status]}`}>
            {STATUS_LABELS[meeting.status]}
          </span>
        </div>

        {/* Status Controls */}
        {isActive && (
          <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-sm text-slate-400 mr-2">Actions:</span>
            {meeting.status === "scheduled" && (
              <button
                onClick={() => handleStatusChange("in_progress")}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start Meeting
              </button>
            )}
            {meeting.status === "in_progress" && (
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Complete Meeting
              </button>
            )}
            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={updating}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel Meeting
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Meeting Details */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500">Date & Time</span>
                  <p className="text-white mt-0.5">{formatDate(meeting.scheduledAt)}</p>
                </div>
                {meeting.location && (
                  <div>
                    <span className="text-slate-500">Location</span>
                    <p className="text-white mt-0.5">{meeting.location}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quorum */}
            <QuorumBadge meeting={meeting} />

            {quorum && (
              <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Quorum Breakdown</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Units</span>
                    <span className="text-white font-medium">{quorum.total_units}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quorum %</span>
                    <span className="text-white font-medium">{quorum.quorum_percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Needed</span>
                    <span className="text-white font-medium">{quorum.quorum_needed}</span>
                  </div>
                  <hr className="border-[#1E293B]" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attendees</span>
                    <span className="text-white font-medium">{quorum.attendee_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Board Members</span>
                    <span className="text-white font-medium">{quorum.board_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Owners</span>
                    <span className="text-white font-medium">{quorum.owner_count}</span>
                  </div>
                </div>
              </div>
            )}

            {meeting.agenda && (
              <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Agenda</h2>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{meeting.agenda}</pre>
              </div>
            )}
          </div>

          {/* Right: Sign-In Sheet */}
          <div className="lg:col-span-2 space-y-4">
            {/* Add Attendee */}
            {isActive && (
              <AddAttendeeForm
                meetingId={meetingId}
                owners={owners}
                onAdded={refresh}
              />
            )}

            {/* Attendee List */}
            <div className="bg-[#0B1121] border border-[#1E293B] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Sign-In Sheet ({attendees.filter((a: any) => a.present).length} present)
                </h2>
                <button onClick={refresh} className="text-xs text-slate-500 hover:text-white transition-colors">
                  Refresh
                </button>
              </div>

              {attendees.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm">No attendees yet.</p>
                  <p className="text-xs mt-1">Add attendees using the form above to start the sign-in sheet.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E293B] text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Name</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Role</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Check-in Time</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Signature</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Voting</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((a: any) => (
                      <tr key={a.id} className={`border-b border-[#1E293B]/50 ${!a.present ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="text-sm text-white font-medium">{a.attendee_name}</div>
                          {a.owners && (
                            <div className="text-xs text-slate-500">{a.owners.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 capitalize">
                            {(a.attendee_role || "owner").replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit",
                          }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.signature_data ? (
                            <img
                              src={a.signature_data}
                              alt="Signature"
                              className="h-10 bg-white rounded border border-gray-300"
                            />
                          ) : (
                            <span className="text-xs text-slate-500">Not signed</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.voting_eligible ? (
                            <span className="text-xs text-emerald-400">Eligible</span>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.present ? (
                            <span className="text-xs text-emerald-400 font-medium">Present</span>
                          ) : (
                            <span className="text-xs text-red-400">Absent</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isActive && (
                            <div className="flex items-center gap-1">
                              {a.present ? (
                                <button
                                  onClick={() => handleRemoveAttendee(a.id)}
                                  className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5"
                                  title="Mark absent"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleMarkPresent(a.id)}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5"
                                  title="Mark present"
                                >
                                  Restore
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
