import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Building2, Lock, Mail, BarChart3, Briefcase, Users, Shield, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

/* ─── Role config ─────────────────────────────────────────────────── */
const ROLE_CONFIG = {
  company_admin: {
    label: "Company Admin",
    desc: "Full control over your firm's portfolio, team, and billing.",
    icon: Building2,
    accent: "text-teal",
    bg: "bg-teal/10",
    dashboardPath: "/dashboard",
  },
  portfolio_manager: {
    label: "Portfolio Manager",
    desc: "Aggregate view across all properties under your management.",
    icon: BarChart3,
    accent: "text-blue-500",
    bg: "bg-blue-50",
    dashboardPath: "/dashboard",
  },
  property_manager: {
    label: "Property Manager",
    desc: "Your property workspace — tickets, calendar, emails, and more.",
    icon: Briefcase,
    accent: "text-amber-500",
    bg: "bg-amber-50",
    dashboardPath: "/dashboard",
  },
  owner: {
    label: "Owner Portal",
    desc: "View your property's reports, financials, and updates.",
    icon: Users,
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
    dashboardPath: "/dashboard",
  },
  // Hidden — not linked from anywhere public
  super_admin: {
    label: "System Administration",
    desc: "Platform-wide access. Authorised personnel only.",
    icon: Shield,
    accent: "text-rose-500",
    bg: "bg-rose-50",
    dashboardPath: "/dashboard/admin",
  },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as [number,number,number,number] } },
};

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const roleParam = params.get("role") as RoleKey | null;

  const role: RoleKey = roleParam && roleParam in ROLE_CONFIG ? roleParam : "company_admin";
  const config = ROLE_CONFIG[role];
  const RoleIcon = config.icon;

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: () => {
      window.location.href = config.dashboardPath;
    },
    onError: (err: any) => {
      setServerError(err.message || "Invalid email or password. Please try again.");
    },
  });

  const onSubmit = (data: LoginForm) => {
    setServerError("");
    loginMutation.mutate({ email: data.email, password: data.password, role });
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — brand / role context ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-navy flex-col justify-between p-12 relative overflow-hidden">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, oklch(0.52 0.12 195) 0%, transparent 70%)" }} />

        <div className="relative">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gold" />
              </div>
              <span className="font-serif text-2xl font-bold text-cream">
                Portier<span className="text-teal">369</span>
              </span>
            </div>
          </Link>
        </div>

        <div className="relative">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className={`w-14 h-14 rounded-2xl ${config.bg} flex items-center justify-center mb-6`}>
              <RoleIcon className={`w-7 h-7 ${config.accent}`} />
            </div>
            <h1 className="font-serif text-4xl font-bold text-cream leading-tight mb-4">
              {config.label}
            </h1>
            <p className="text-cream/55 text-lg leading-relaxed max-w-xs">
              {config.desc}
            </p>
          </motion.div>
        </div>

        <div className="relative">
          <p className="text-xs text-cream/30">
            © {new Date().getFullYear()} Portier369 · Invite-only platform
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 bg-background">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-gold" />
                </div>
                <span className="font-serif text-xl font-bold text-navy">
                  Portier<span className="text-teal">369</span>
                </span>
              </div>
            </Link>
          </div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            {/* Back link */}
            <Link href="/">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy transition-colors mb-8 cursor-pointer w-fit">
                <ArrowLeft className="w-4 h-4" />
                Back to home
              </div>
            </Link>

            <h2 className="font-serif text-3xl font-bold text-navy mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Signing in as{" "}
              <span className={`font-semibold ${config.accent}`}>{config.label}</span>
            </p>

            {serverError && (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{serverError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-navy/80">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="pl-10 h-11 border-border focus:border-teal focus:ring-teal/20 bg-white"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-navy/80">Password</Label>
                  <a href="#" className="text-xs text-teal hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pl-10 pr-11 h-11 border-border focus:border-teal focus:ring-teal/20 bg-white"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-11 bg-navy hover:bg-navy-light text-cream font-semibold text-sm transition-all"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : `Sign in to ${config.label}`}
              </Button>
            </form>

            {/* Switch portal */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">Sign in to a different portal</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][])
                  .filter(([key]) => key !== "super_admin" && key !== role)
                  .map(([key, cfg]) => (
                    <Link key={key} href={`/login?role=${key}`}>
                      <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-teal hover:text-teal transition-colors text-muted-foreground bg-white">
                        {cfg.label}
                      </button>
                    </Link>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
