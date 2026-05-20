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

export async function getOrCreateCompany(name: string, slug: string) {
  const { data: existing } = await supabase.from("companies").select("*").eq("slug", slug).single();
  if (existing) return existing;
  const { data, error } = await supabase.from("companies").insert({ name, slug }).select().single();
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
  propertyType?: string;
  totalUnits?: number;
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
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date | string | null;
}) {
  const now = new Date().toISOString();
  const lastSignedInVal = data.lastSignedIn
    ? (data.lastSignedIn instanceof Date ? data.lastSignedIn.toISOString() : data.lastSignedIn)
    : now;

  // First try to update existing user
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    const updateFields: Record<string, unknown> = { lastSignedIn: lastSignedInVal, updatedAt: now };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.email !== undefined) updateFields.email = data.email;
    if (data.loginMethod !== undefined) updateFields.loginMethod = data.loginMethod;
    const { data: updated, error } = await supabase
      .from("users")
      .update(updateFields)
      .eq("openId", data.openId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  }

  // New user — check if first user for super_admin promotion
  const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
  const role = count === 0 ? "super_admin" : "user";

  // Use upsert with onConflict to handle race conditions gracefully
  const insertData: Record<string, unknown> = {
    openId: data.openId,
    role,
    lastSignedIn: lastSignedInVal,
    createdAt: now,
    updatedAt: now,
  };
  if (data.name !== undefined) insertData.name = data.name;
  if (data.email !== undefined) insertData.email = data.email;
  if (data.loginMethod !== undefined) insertData.loginMethod = data.loginMethod;

  const { data: created, error } = await supabase
    .from("users")
    .upsert(insertData, { onConflict: "openId", ignoreDuplicates: false })
    .select()
    .single();

  // If duplicate key error (race condition), fall back to SELECT
  if (error) {
    if (error.code === "23505") {
      // Duplicate key — user was created by a concurrent request, just return it
      return await getUserByOpenId(data.openId);
    }
    throw new Error(error.message);
  }
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
// vendors table uses snake_case columns: name, trade, portfolio_id, archived_at
export async function getAllVendors(search?: string, trade?: string) {
  let query = supabase.from("vendors").select("*").is("archived_at", null).order("name");
  if (search) query = query.ilike("name", `%${search}%`);
  if (trade) query = query.eq("trade", trade);
  const { data, error } = await query;
  if (error) { console.error("[DB] getAllVendors:", error.message); return []; }
  return data ?? [];
}

export async function createVendor(data: {
  companyId?: number;
  companyName?: string;
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentType?: string;
  w9OnFile?: boolean;
  is1099Vendor?: boolean;
}) {
  // Map to actual vendor table columns
  const vendorData: Record<string, unknown> = {
    name: data.name ?? data.companyName ?? "",
    vendor_type: "vendor",
  };
  if (data.email) vendorData.emails = [data.email];
  if (data.phone) vendorData.phone_numbers = [data.phone];
  if (data.paymentType) vendorData.payment_type = data.paymentType;
  if (data.is1099Vendor !== undefined) vendorData.send_1099 = data.is1099Vendor;
  const { data: result, error } = await supabase.from("vendors").insert(vendorData).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── OWNERS ───────────────────────────────────────────────────────────────────
// owners table uses snake_case: first_name, last_name, full_name, archived_at (no propertyId)
export async function getOwners(propertyIds: number[] | null, search?: string) {
  let query = supabase.from("owners").select("*").is("archived_at", null).order("last_name");
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { console.error("[DB] getOwners:", error.message); return []; }
  return data ?? [];
}

export async function createOwner(data: {
  propertyId?: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  unit?: string;
  portalAccess?: boolean;
}) {
  const ownerData: Record<string, unknown> = {
    first_name: data.firstName,
    last_name: data.lastName,
    full_name: `${data.firstName} ${data.lastName}`,
  };
  if (data.email) ownerData.email = data.email;
  if (data.phone) ownerData.phone = data.phone;
  if (data.portalAccess !== undefined) ownerData.portal_activated = data.portalAccess;
  const { data: result, error } = await supabase.from("owners").insert(ownerData).select().single();
  if (error) throw new Error(error.message);
  return result;
}

// ─── GL ACCOUNTS ──────────────────────────────────────────────────────────────
// gl_accounts table uses: number, name, account_type, active, portfolio_id, association_id
export async function getGlAccounts(propertyId?: number) {
  let query = supabase.from("gl_accounts").select("*").eq("active", true).order("number");
  if (propertyId) query = query.eq("association_id", propertyId);
  const { data, error } = await query;
  if (error) { console.error("[DB] getGlAccounts:", error.message); return []; }
  return data ?? [];
}

export async function createGlAccount(data: {
  accountNumber?: string | number;
  accountName?: string;
  name?: string;
  accountType?: string;
  account_type?: string;
  propertyId?: number;
  parentAccountId?: number;
  description?: string;
  fundAccount?: string;
  portfolioId?: string;
}) {
  const glData: Record<string, unknown> = {
    number: data.accountNumber ?? 0,
    name: data.accountName ?? data.name ?? "",
    account_type: data.accountType ?? data.account_type ?? "expense",
    active: true,
  };
  if (data.description) glData.description = data.description;
  if (data.fundAccount) glData.fund_account = data.fundAccount;
  if (data.portfolioId) glData.portfolio_id = data.portfolioId;
  if (data.propertyId) glData.association_id = data.propertyId;
  const { data: result, error } = await supabase.from("gl_accounts").insert(glData).select().single();
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
  if (error) {
    // updatedAt may not exist in all schemas, try without it
    const { data: d2, error: e2 } = await supabase.from("transactions").update({ status }).eq("id", id).select().single();
    if (e2) throw new Error(e2.message);
    return d2;
  }
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

export async function createCompany(data: { name: string; code?: string; slug?: string; address?: string; phone?: string; email?: string }) {
  const slug = data.slug ?? data.code ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { data: result, error } = await supabase.from("companies").insert({ name: data.name, slug, address: data.address, phone: data.phone, email: data.email }).select().single();
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
