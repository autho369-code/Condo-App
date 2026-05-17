export const COOKIE_NAME = "portier_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const PORTIER_ROLES = [
  "super_admin",
  "company_admin",
  "portfolio_manager",
  "property_manager",
  "accountant",
  "assistant_manager",
  "owner",
  "vendor",
  "resident",
  "user",
] as const;

export type PortierRole = (typeof PORTIER_ROLES)[number];

export const ROLE_LABELS: Record<PortierRole, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  portfolio_manager: "Portfolio Manager",
  property_manager: "Property Manager",
  accountant: "Accountant",
  assistant_manager: "Assistant Manager",
  owner: "Owner",
  vendor: "Vendor",
  resident: "Resident",
  user: "User",
};

export const ROLE_HIERARCHY: Record<PortierRole, number> = {
  super_admin: 100,
  company_admin: 80,
  portfolio_manager: 60,
  property_manager: 40,
  accountant: 20,
  assistant_manager: 20,
  owner: 10,
  vendor: 10,
  resident: 5,
  user: 0,
};
