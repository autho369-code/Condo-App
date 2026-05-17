/**
 * SuperAdmin login — intentionally NOT linked from any public page.
 * Access via direct URL: /sa-access
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { motion } from "framer-motion";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Required"),
});
type Form = z.infer<typeof schema>;

export default function SuperAdminLogin() {
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: () => { window.location.href = "/dashboard/admin"; },
    onError: (err: any) => setError(err.message || "Access denied."),
  });

  const onSubmit = (data: Form) => {
    setError("");
    loginMutation.mutate({ email: data.email, password: data.password, role: "super_admin" });
  };

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.03_255)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-rose-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-cream">System Administration</h1>
          <p className="text-xs text-cream/40 mt-1">Authorised personnel only</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5 border-red-800 bg-red-950/50">
            <AlertDescription className="text-red-400 text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-cream/60 uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="pl-10 h-11 bg-white/5 border-white/10 text-cream placeholder:text-cream/25 focus:border-rose-500/50 focus:ring-rose-500/20"
                placeholder="admin@portier369.com"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-cream/60 uppercase tracking-wider">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                className="pl-10 pr-11 h-11 bg-white/5 border-white/10 text-cream placeholder:text-cream/25 focus:border-rose-500/50 focus:ring-rose-500/20"
                placeholder="••••••••••••"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-semibold mt-2"
          >
            {loginMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating…
              </span>
            ) : "Access System"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
