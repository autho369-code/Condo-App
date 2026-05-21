import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Roles that can run reports (all except owner/user)
const REPORT_ROLES = ['super_admin','company_admin','portfolio_manager','manager','accountant','assistant','board_member','admin'] as const;

// Board member can only run limited financial reports for their association
export const BOARD_MEMBER_ALLOWED_REPORTS = [
  'balance_sheet','income_statement','fund_income_statement','fund_balance',
  'trial_balance','chart_of_accounts','delinquency_report','homeowner_delinquency',
  'hoa_assessment_roll','reserve_fund_analysis','budget_vs_actual',
] as const;

export const reportsProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHED_ERR_MSG });
    }
    const role = ctx.user.role as string;
    if (!REPORT_ROLES.includes(role as any)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access reports.' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
