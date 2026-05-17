import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to continue." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.portierRole !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required." });
  }
  return next({ ctx });
});

export const companyProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["super_admin", "company_admin", "portfolio_manager", "property_manager"];
  if (!ctx.user.portierRole || !allowed.includes(ctx.user.portierRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Company access required." });
  }
  return next({ ctx });
});
