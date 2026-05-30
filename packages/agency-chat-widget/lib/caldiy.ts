/**
 * Cal.diy Integration Module
 * 
 * Wraps the cal.diy API for:
 * - Fetching availability slots
 * - Creating bookings
 * - Cancelling bookings
 * - Webhook handling for booking confirmations
 * 
 * Usage:
 *   import { getSlots, createBooking, cancelBooking } from "./caldiy";
 */

const CALDIY_BASE = process.env.CALDIY_API_URL || "https://cal.diy/api/v1";
const CALDIY_KEY = process.env.CALDIY_API_KEY || "";

interface Slot {
  start: string;  // ISO 8601
  end: string;
}

interface BookingRequest {
  name: string;
  email: string;
  phone?: string;
  start: string;
  durationMinutes?: number;
  title?: string;
  notes?: string;
}

interface BookingResult {
  id: string;
  status: string;
  start: string;
  end: string;
  meetLink?: string;
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${CALDIY_BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${CALDIY_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cal.diy ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}

/** Get available time slots for a date range */
export async function getSlots(dateFrom: string, dateTo: string): Promise<Slot[]> {
  const data = await call("GET", `/slots?from=${dateFrom}&to=${dateTo}`);
  return data.slots || [];
}

/** Create a new booking */
export async function createBooking(req: BookingRequest): Promise<BookingResult> {
  const data = await call("POST", "/bookings", {
    name: req.name,
    email: req.email,
    phone: req.phone,
    start: req.start,
    durationMinutes: req.durationMinutes || 60,
    title: req.title || "Consultation",
    notes: req.notes,
  });

  return {
    id: data.id,
    status: data.status || "confirmed",
    start: data.start,
    end: data.end,
    meetLink: data.meetLink,
  };
}

/** Cancel a booking */
export async function cancelBooking(bookingId: string): Promise<void> {
  await call("DELETE", `/bookings/${bookingId}`);
}

/** Verify webhook signature (if cal.diy provides HMAC) */
export function verifyWebhook(body: string, signature: string): boolean {
  // Implement HMAC verification if cal.diy provides webhook secrets
  return true; // Placeholder
}
