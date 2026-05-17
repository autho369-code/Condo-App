import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Send,
  Building2,
  User,
  Clock,
  CheckCheck,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Thread = {
  threadKey: string;
  ownerId: number;
  ownerName: string | null;
  propertyId: number;
  propertyName: string;
  subject: string | null;
  lastBody: string;
  lastDirection: string;
  lastMessageAt: Date | string;
  unreadCount: number;
};

type Message = {
  id: number;
  ownerId: number;
  managerId: number | null;
  direction: "owner_to_manager" | "manager_to_owner";
  channel: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  isReadByManager: boolean;
  threadKey: string | null;
  createdAt: Date | string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dt: Date | string): string {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Thread List Item ─────────────────────────────────────────────────────────
function ThreadItem({
  thread,
  isActive,
  onClick,
}: {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors border-b border-border/50 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive ? "bg-accent" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: name + time + unread badge */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${thread.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
              {thread.ownerName ?? `Owner #${thread.ownerId}`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {thread.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {thread.unreadCount}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">{formatTime(thread.lastMessageAt)}</span>
            </div>
          </div>

          {/* Row 2: property */}
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{thread.propertyName}</span>
          </div>

          {/* Row 3: last message preview */}
          <p className={`text-xs mt-1 truncate ${thread.unreadCount > 0 ? "text-foreground/90" : "text-muted-foreground"}`}>
            {thread.lastDirection === "manager_to_owner" && (
              <span className="text-primary/70 mr-1">You:</span>
            )}
            {truncate(thread.lastBody)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, managerName }: { msg: Message; managerName: string }) {
  const isManager = msg.direction === "manager_to_owner";
  return (
    <div className={`flex ${isManager ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isManager
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <div className={`flex items-center gap-1 mt-1 ${isManager ? "justify-end" : "justify-start"}`}>
          <span className={`text-[10px] ${isManager ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {isManager ? managerName : "Owner"} · {formatTime(msg.createdAt)}
          </span>
          {isManager && (
            <CheckCheck className={`w-3 h-3 ${msg.isRead ? "text-primary-foreground" : "text-primary-foreground/50"}`} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">No messages yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Owner messages will appear here when owners contact management through the portal.
        </p>
      </div>
    </div>
  );
}

function NoThreadSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">Select a conversation</p>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a thread from the list to read messages and reply.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OwnerMessages() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads } =
    trpc.documents.getMessageThreads.useQuery(undefined, {
      refetchInterval: 30_000, // poll every 30s for new messages
    });

  const activeThread = threads.find(t => t.threadKey === activeThreadKey) ?? null;

  const { data: messages = [], isLoading: messagesLoading } =
    trpc.documents.getThreadMessages.useQuery(
      { threadKey: activeThreadKey! },
      { enabled: !!activeThreadKey, refetchInterval: 15_000 }
    );

  // ── Auto-scroll to bottom when messages load/change ───────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mark thread as read when opened ───────────────────────────────────────
  const markRead = trpc.documents.markThreadRead.useMutation({
    onSuccess: () => utils.documents.getMessageThreads.invalidate(),
  });

  function openThread(threadKey: string) {
    setActiveThreadKey(threadKey);
    setReplyBody("");
    const thread = threads.find(t => t.threadKey === threadKey);
    if (thread && thread.unreadCount > 0) {
      markRead.mutate({ threadKey });
    }
  }

  // ── Send reply ─────────────────────────────────────────────────────────────
  const sendReply = trpc.documents.replyToOwner.useMutation({
    onSuccess: () => {
      setReplyBody("");
      utils.documents.getThreadMessages.invalidate({ threadKey: activeThreadKey! });
      utils.documents.getMessageThreads.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
    },
  });

  function handleSend() {
    if (!replyBody.trim() || !activeThread) return;
    sendReply.mutate({
      ownerId: activeThread.ownerId,
      propertyId: activeThread.propertyId,
      threadKey: activeThread.threadKey,
      body: replyBody.trim(),
      subject: activeThread.subject ?? undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const managerName = user?.name ?? "Manager";
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <DashboardLayout>
    <div className="flex flex-col h-full">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Owner Messages</h1>
            <p className="text-xs text-muted-foreground">
              {totalUnread > 0
                ? `${totalUnread} unread message${totalUnread !== 1 ? "s" : ""}`
                : "All messages read"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetchThreads()}
          className="text-muted-foreground"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Thread list */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Conversations ({threads.length})
            </p>
          </div>

          {threadsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <EmptyInbox />
          ) : (
            <ScrollArea className="flex-1">
              {threads
                .slice()
                .sort((a, b) => {
                  // Unread first, then by most recent
                  if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
                  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
                })
                .map(thread => (
                  <ThreadItem
                    key={thread.threadKey}
                    thread={thread}
                    isActive={thread.threadKey === activeThreadKey}
                    onClick={() => openThread(thread.threadKey)}
                  />
                ))}
            </ScrollArea>
          )}
        </div>

        {/* Right: Thread detail + reply */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeThread ? (
            <NoThreadSelected />
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-3 border-b border-border bg-card flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {activeThread.ownerName ?? `Owner #${activeThread.ownerId}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1">
                      <Building2 className="w-2.5 h-2.5" />
                      {activeThread.propertyName}
                    </Badge>
                    {activeThread.subject && (
                      <span className="text-xs text-muted-foreground truncate">
                        Re: {activeThread.subject}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatTime(activeThread.lastMessageAt)}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-5 py-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground mt-8">No messages in this thread yet.</p>
                ) : (
                  <>
                    {messages.map(msg => (
                      <MessageBubble key={msg.id} msg={msg as Message} managerName={managerName} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </ScrollArea>

              <Separator />

              {/* Reply compose box */}
              <div className="px-5 py-4 bg-card">
                <div className="flex gap-3 items-end">
                  <Textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Reply to ${activeThread.ownerName ?? "owner"}… (Ctrl+Enter to send)`}
                    className="flex-1 min-h-[80px] max-h-[160px] resize-none text-sm"
                    disabled={sendReply.isPending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!replyBody.trim() || sendReply.isPending}
                    className="h-10 px-4 shrink-0"
                  >
                    {sendReply.isPending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1.5" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Replies are sent as in-app messages. The owner will see them in their portal.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
