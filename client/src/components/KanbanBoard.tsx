import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Paperclip, GripVertical, AlertTriangle, Clock, CheckCircle2, XCircle, Wrench } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TicketStatus = "open" | "in_progress" | "pending_vendor" | "resolved" | "closed";

export interface KanbanTicket {
  id: number;
  title: string;
  status: TicketStatus | null;
  priority: string | null;
  category: string | null;
  unitNumber: string | null;
  createdAt: Date;
  attachmentCount?: number;
}

interface KanbanBoardProps {
  tickets: KanbanTicket[];
  onStatusChange: (ticketId: number, newStatus: TicketStatus) => void;
  isUpdating?: boolean;
}

// ─── Column config ────────────────────────────────────────────────────────────
const COLUMNS: { id: TicketStatus; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  {
    id: "open",
    label: "Open",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  {
    id: "in_progress",
    label: "In Progress",
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    icon: <Wrench className="w-3.5 h-3.5" />,
  },
  {
    id: "pending_vendor",
    label: "Pending Vendor",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  {
    id: "resolved",
    label: "Resolved",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  {
    id: "closed",
    label: "Closed",
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

// ─── Draggable Ticket Card ────────────────────────────────────────────────────
function KanbanCard({
  ticket,
  isDragging = false,
  overlay = false,
}: {
  ticket: KanbanTicket;
  isDragging?: boolean;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id, disabled: overlay });

  const style = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.35 : 1,
      };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`group bg-white rounded-xl border shadow-sm p-3 cursor-grab active:cursor-grabbing select-none transition-shadow ${
        overlay || isDragging
          ? "shadow-xl ring-2 ring-olive/40 rotate-1"
          : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...(overlay ? {} : { ...attributes, ...listeners })}
          className="mt-0.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-sm font-medium text-charcoal leading-snug line-clamp-2 mb-2">
            {ticket.title}
          </p>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1 items-center">
            {ticket.priority && (
              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                {ticket.priority}
              </Badge>
            )}
            {ticket.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                {ticket.category.replace(/_/g, " ")}
              </Badge>
            )}
            {ticket.unitNumber && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                Unit {ticket.unitNumber}
              </Badge>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </span>
            {(ticket.attachmentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Paperclip className="w-2.5 h-2.5" />
                {ticket.attachmentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────
function KanbanColumn({
  column,
  tickets,
  isOver,
}: {
  column: (typeof COLUMNS)[number];
  tickets: KanbanTicket[];
  isOver: boolean;
}) {
  // Register the column itself as a droppable target so empty columns accept drops
  const { setNodeRef: setDropRef } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0">
      {/* Column header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0 ${column.bg} ${column.color} mb-0`}
      >
        {column.icon}
        <span className="text-xs font-semibold">{column.label}</span>
        <span className="ml-auto text-xs font-bold opacity-60">{tickets.length}</span>
      </div>

      {/* Drop zone — registered as droppable so empty columns work */}
      <div
        ref={setDropRef}
        className={`flex-1 rounded-b-xl border-2 transition-colors duration-150 p-2 space-y-2 min-h-[120px] ${
          isOver
            ? "border-olive bg-olive/5 border-dashed"
            : "border-muted bg-muted/20"
        }`}
      >
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 select-none">
              Drop tickets here
            </div>
          ) : (
            tickets.map((ticket) => (
              <KanbanCard key={ticket.id} ticket={ticket} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Main KanbanBoard ─────────────────────────────────────────────────────────
export default function KanbanBoard({ tickets, onStatusChange }: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<KanbanTicket | null>(null);
  const [overColumnId, setOverColumnId] = useState<TicketStatus | null>(null);

  // Optimistic local status map: ticketId → status
  const [localStatus, setLocalStatus] = useState<Record<number, TicketStatus>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const getEffectiveStatus = useCallback(
    (ticket: KanbanTicket): TicketStatus =>
      localStatus[ticket.id] ?? (ticket.status as TicketStatus) ?? "open",
    [localStatus]
  );

  const columnTickets = useCallback(
    (colId: TicketStatus) => tickets.filter((t) => getEffectiveStatus(t) === colId),
    [tickets, getEffectiveStatus]
  );

  // Find which column a ticket id belongs to
  const findColumn = useCallback(
    (ticketId: number): TicketStatus | null => {
      for (const col of COLUMNS) {
        if (columnTickets(col.id).some((t) => t.id === ticketId)) return col.id;
      }
      return null;
    },
    [columnTickets]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumnId(null); return; }

    // over.id can be a column id (string) or a ticket id (number)
    const overId = over.id;
    const isColumn = COLUMNS.some((c) => c.id === overId);
    if (isColumn) {
      setOverColumnId(overId as TicketStatus);
    } else {
      // hovering over a ticket — find its column
      const col = findColumn(overId as number);
      setOverColumnId(col);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    setOverColumnId(null);

    if (!over) return;

    const ticketId = active.id as number;
    const overId = over.id;

    // Determine target column
    let targetColumn: TicketStatus | null = null;
    const isColumn = COLUMNS.some((c) => c.id === overId);
    if (isColumn) {
      targetColumn = overId as TicketStatus;
    } else {
      targetColumn = findColumn(overId as number);
    }

    if (!targetColumn) return;

    const currentStatus = getEffectiveStatus(tickets.find((t) => t.id === ticketId)!);
    if (currentStatus === targetColumn) return;

    // Optimistic update
    setLocalStatus((prev) => ({ ...prev, [ticketId]: targetColumn! }));

    // Persist via tRPC
    onStatusChange(ticketId, targetColumn);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tickets={columnTickets(col.id)}
            isOver={overColumnId === col.id}
          />
        ))}
      </div>

      {/* Drag overlay — floating card that follows cursor */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeTicket ? (
          <KanbanCard ticket={activeTicket} overlay isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
