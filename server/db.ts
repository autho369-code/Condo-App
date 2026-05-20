/**
 * server/db.ts — All database helpers now use Supabase PostgreSQL
 */
import { supabase } from "./supabase";

// ─── COMPANIES ────────────────────────────────────────────────────────────────
export async function getCompanies() {
  const { data, error } = await supabase.from("companies").select("*").order("name");
  if (error) { console.error("[DB] getCompanies:", error.message); return []; }
  return data ?? [];
}

export async function getOrCreateCompany(name: string, code: string) {
  const { data: existing } = await supabase.from("companies").select("*").eq("code", code).single();
  if (existing) return existing;
  const { data, error } = await supabase.from("companies").insert({ name, code }).select().single();
  if (error) { console.error("[DB] getOrCreateCompany:", error.message); return null; }
  return data;
}

// ─── PROPERTIES / ASSOCIATIONS ────────────────────────────────────────────────
export async function getProperties(propertyIds: number[] | null) {
  let query = supabase.from("properties").select("*").order("name");
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("id", propertyIds);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getProperties:", error.message); return []; }
  return data ?? [];
}

export async function createProperty(data: {
  companyId: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  type?: string;
  unitCount?: number;
}) {
  const { data: result, error } = await supabase.from("properties").insert(data).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export async function getUserByOpenId(openId: string) {
  const { data, error } = await supabase.from("users").select("*").eq("openId", openId).single();
  if (error && error.code !== "PGRST116") console.error("[DB] getUserByOpenId:", error.message);
  return data ?? null;
}

export async function upsertUser(data: {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
}) {
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    const { data: updated, error } = await supabase
      .from("users")
      .update({ name: data.name, email: data.email, lastSignedIn: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("openId", data.openId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  }
  // Check if this is the first user — auto-promote to super_admin
  const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
  const role = count === 0 ? "super_admin" : "user";
  const { data: created, error } = await supabase
    .from("users")
    .insert({ ...data, role })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return created;
}

export async function getAllUsers(search?: string) {
  let query = supabase.from("users").select("*").order("createdAt");
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getAllUsers:", error.message); return []; }
  return data ?? [];
}

export async function updateUserRole(userId: number, role: string) {
  const { data, error } = await supabase.from("users").update({ role, updatedAt: new Date().toISOString() }).eq("id", userId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── VENDORS ──────────────────────────────────────────────────────────────────
export async function getAllVendors(search?: string, trade?: string) {
  let query = supabase.from("vendors").select("*").eq("isActive", true).order("companyName");
  if (search) query = query.ilike("companyName", `%${search}%`);
  const { data, error } = await query;
  if (error) { console.error("[DB] getAllVendors:", error.message); return []; }
  let result = data ?? [];
  if (trade) result = result.filter((v: any) => Array.isArray(v.trades) && v.trades.includes(trade));
  return result;
}

export async function createVendor(data: {
  companyId: number;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentType?: string;
  w9OnFile?: boolean;
  is1099Vendor?: boolean;
}) {
  const { data: result, error } = await supabase.from("vendors").insert({ ...data, isActive: true }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── OWNERS ───────────────────────────────────────────────────────────────────
export async function getOwners(propertyIds: number[] | null, search?: string) {
  let query = supabase.from("owners").select("*").eq("isActive", true).order("lastName");
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  if (search) query = query.or(`firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { console.error("[DB] getOwners:", error.message); return []; }
  return data ?? [];
}

export async function createOwner(data: {
  propertyId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  unit?: string;
}) {
  const { data: result, error } = await supabase.from("owners").insert({ ...data, isActive: true }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── GL ACCOUNTS ──────────────────────────────────────────────────────────────
export async function getGlAccounts(propertyId?: number) {
  let query = supabase.from("gl_accounts").select("*").eq("isActive", true).order("accountNumber");
  if (propertyId) query = query.eq("propertyId", propertyId);
  const { data, error } = await query;
  if (error) { console.error("[DB] getGlAccounts:", error.message); return []; }
  return data ?? [];
}

export async function createGlAccount(data: {
  accountNumber: string;
  accountName: string;
  accountType: string;
  propertyId?: number;
  parentAccountId?: number;
  description?: string;
}) {
  const { data: result, error } = await supabase.from("gl_accounts").insert({ ...data, isActive: true }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── BANK ACCOUNTS ────────────────────────────────────────────────────────────
export async function getBankAccounts(propertyIds: number[] | null) {
  let query = supabase.from("bank_accounts").select("*").order("name");
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getBankAccounts:", error.message); return []; }
  return data ?? [];
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export async function getTransactions(propertyIds: number[] | null, type?: string, status?: string) {
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  if (type) query = query.eq("transactionType", type);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) { console.error("[DB] getTransactions:", error.message); return []; }
  return data ?? [];
}

export async function getPendingBills(propertyIds: number[] | null) {
  return getTransactions(propertyIds, "bill", "pending");
}

export async function createTransaction(data: {
  propertyId: number;
  transactionType: string;
  date: string;
  amount: string;
  glAccountId?: number;
  vendorId?: number;
  ownerId?: number;
  referenceNumber?: string;
  description?: string;
  status?: string;
  createdBy?: number;
}) {
  const { data: result, error } = await supabase.from("transactions").insert({ ...data, status: data.status ?? "pending" }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

export async function updateTransactionStatus(id: number, status: string) {
  const { data, error } = await supabase.from("transactions").update({ status, updatedAt: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── INVITATIONS ──────────────────────────────────────────────────────────────
export async function getInvitations(companyId?: number) {
  let query = supabase.from("invitations").select("*").order("createdAt", { ascending: false });
  if (companyId) query = query.eq("companyId", companyId);
  const { data, error } = await query;
  if (error) { console.error("[DB] getInvitations:", error.message); return []; }
  return data ?? [];
}

export async function getInvitationByToken(token: string) {
  const { data, error } = await supabase.from("invitations").select("*").eq("token", token).single();
  if (error && error.code !== "PGRST116") console.error("[DB] getInvitationByToken:", error.message);
  return data ?? null;
}

export async function createInvitation(data: {
  token: string;
  email: string;
  role: string;
  companyId?: number;
  assignedPropertyIds?: number[];
  invitedBy: number;
  expiresAt: string;
}) {
  const { data: result, error } = await supabase.from("invitations").insert({ ...data, status: "pending" }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

export async function updateInvitationStatus(token: string, status: string) {
  const { data, error } = await supabase
    .from("invitations")
    .update({ status, acceptedAt: status === "accepted" ? new Date().toISOString() : null })
    .eq("token", token)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── DIAGNOSTIC FLAGS ─────────────────────────────────────────────────────────
export async function getDiagnosticFlags(propertyIds: number[] | null) {
  let query = supabase.from("diagnostic_flags").select("*").order("detectedAt", { ascending: false });
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getDiagnosticFlags:", error.message); return []; }
  return data ?? [];
}

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────────────
export async function getRecentActivity(propertyIds: number[] | null, hours = 24, limit = 50) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let query = supabase.from("recent_activity").select("*").gte("createdAt", since).order("createdAt", { ascending: false }).limit(limit);
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getRecentActivity:", error.message); return []; }
  return data ?? [];
}

export async function logActivity(data: {
  userId: number;
  propertyId?: number;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("recent_activity").insert(data);
  if (error) console.error("[DB] logActivity:", error.message);
}

// ─── SCHEDULED REPORTS ────────────────────────────────────────────────────────
export async function getScheduledReports(propertyIds: number[] | null) {
  let query = supabase.from("scheduled_reports").select("*").order("reportName");
  if (propertyIds !== null) {
    if (propertyIds.length === 0) return [];
    query = query.in("propertyId", propertyIds);
  }
  const { data, error } = await query;
  if (error) { console.error("[DB] getScheduledReports:", error.message); return []; }
  return data ?? [];
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
export async function getDashboardStats(propertyIds: number[] | null) {
  const [propList, ownerList, bills, vendorData] = await Promise.all([
    getProperties(propertyIds),
    getOwners(propertyIds),
    getPendingBills(propertyIds),
    propertyIds === null ? getAllVendors() : Promise.resolve([]),
  ]);
  return {
    associations: propList.length,
    vendors: vendorData.length,
    owners: ownerList.length,
    openBills: bills.length,
  };
}

// Legacy export kept for auth compatibility
export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
};

// ─── COMPANIES (ADDITIONAL) ───────────────────────────────────────────────────
export async function getAllCompanies() {
  return getCompanies();
}

export async function createCompany(data: { name: string; code: string; address?: string; phone?: string; email?: string }) {
  const { data: result, error } = await supabase.from("companies").insert({ ...data, isActive: true }).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── VENDORS (ALIAS) ──────────────────────────────────────────────────────────
export async function getVendors(propertyIds: number[] | null, search?: string, trade?: string) {
  // Vendors are company-wide, not per-property — propertyIds ignored
  return getAllVendors(search, trade);
}

// ─── INVITATIONS (ADDITIONAL) ─────────────────────────────────────────────────
export async function getAllInvitations() {
  return getInvitations();
}

export async function getInvitationsByInviter(userId: number) {
  const { data, error } = await supabase.from("invitations").select("*").eq("invitedBy", userId).order("createdAt", { ascending: false });
  if (error) { console.error("[DB] getInvitationsByInviter:", error.message); return []; }
  return data ?? [];
}

export async function acceptInvitation(token: string, userId: number) {
  const inv = await getInvitationByToken(token);
  if (!inv) throw new Error("Invitation not found");
  if (inv.status !== "pending") throw new Error("Invitation already used");
  if (new Date(inv.expiresAt) < new Date()) throw new Error("Invitation expired");
  await updateInvitationStatus(token, "accepted");
  // Update user role
  const { error } = await supabase.from("users").update({ role: inv.role, companyId: inv.companyId, assignedPropertyIds: inv.assignedPropertyIds, updatedAt: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error(error.message);
  return inv;
}

export async function revokeInvitation(token: string) {
  return updateInvitationStatus(token, "revoked");
}

// ─── TRANSACTIONS (ADDITIONAL) ────────────────────────────────────────────────
export async function approveBill(transactionId: number) {
  return updateTransactionStatus(transactionId, "approved");
}

// ─── RBAC HELPERS ─────────────────────────────────────────────────────────────
export async function getAccessiblePropertyIds(user: { role: string; companyId?: number | null; assignedPropertyIds?: number[] | null }): Promise<number[] | null> {
  // super_admin and admin see all properties
  if (["super_admin", "admin"].includes(user.role)) return null;
  // company_admin and portfolio_manager see all properties in their company
  if (["company_admin", "portfolio_manager"].includes(user.role) && user.companyId) {
    const props = await getProperties(null);
    return props.filter((p: any) => p.companyId === user.companyId).map((p: any) => p.id);
  }
  // Others see only assigned properties
  return user.assignedPropertyIds ?? [];
}
