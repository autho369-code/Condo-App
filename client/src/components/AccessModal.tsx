import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, ArrowRight, Building2, Users, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface AccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: string;
}

const PLANS = [
  { id: "foundation",    label: "Foundation",    price: "$149/mo", units: "Up to 50 units" },
  { id: "professional",  label: "Professional",  price: "$349/mo", units: "Up to 150 units" },
  { id: "portfolio",     label: "Portfolio",     price: "$749/mo", units: "Up to 500 units" },
  { id: "enterprise",    label: "Enterprise",    price: "Custom",  units: "Unlimited" },
];

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];

export function AccessModal({ isOpen, onClose, defaultPlan }: AccessModalProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan ?? "professional");
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    unitCount: "",
    currentSoftware: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => setStep("success"),
    onError: (err) => setErrors({ submit: err.message }),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Full name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required";
    if (!form.companyName.trim() || form.companyName.trim().length < 2) e.companyName = "Company name is required";
    const units = parseInt(form.unitCount);
    if (!form.unitCount || isNaN(units) || units < 1) e.unitCount = "Enter a valid unit count";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    submitLead.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.companyName.trim(),
      unitCount: parseInt(form.unitCount) || undefined,
      currentSoftware: form.currentSoftware.trim() || undefined,
      plan: selectedPlan || undefined,
      message: form.message.trim() || undefined,
    });
  }

  function handleClose() {
    onClose();
    // Reset after animation
    setTimeout(() => { setStep("form"); setErrors({}); }, 300);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl pointer-events-auto"
              style={{ background: "oklch(0.12 0.025 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10"
                style={{ background: "oklch(1 0 0 / 0.06)" }}
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>

              <AnimatePresence mode="wait">
                {step === "form" ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-10"
                  >
                    {/* Header */}
                    <div className="mb-8">
                      <p className="text-[10px] font-bold tracking-[0.22em] uppercase mb-3"
                        style={{ color: "oklch(0.72 0.15 185)" }}>
                        Private Access Request
                      </p>
                      <h2 className="font-serif font-bold text-white mb-2"
                        style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
                        Let's Talk About Your Community
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: "oklch(1 0 0 / 0.4)" }}>
                        Our team will review your request and reach out within one business day to discuss your operational needs.
                      </p>
                    </div>

                    {/* Plan selector */}
                    <div className="mb-7">
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
                        style={{ color: "oklch(1 0 0 / 0.35)" }}>
                        Interested Plan
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PLANS.map((plan) => (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlan(plan.id)}
                            className="rounded-xl px-3 py-3 text-left transition-all duration-200 border"
                            style={{
                              background: selectedPlan === plan.id ? "oklch(0.72 0.15 185 / 0.15)" : "oklch(1 0 0 / 0.04)",
                              borderColor: selectedPlan === plan.id ? "oklch(0.72 0.15 185 / 0.6)" : "oklch(1 0 0 / 0.08)",
                            }}
                          >
                            <p className="text-xs font-bold text-white mb-0.5">{plan.label}</p>
                            <p className="text-[10px]" style={{ color: "oklch(0.72 0.15 185)" }}>{plan.price}</p>
                            <p className="text-[10px]" style={{ color: "oklch(1 0 0 / 0.3)" }}>{plan.units}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name + Email */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                            style={{ color: "oklch(1 0 0 / 0.35)" }}>
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Jane Smith"
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                            style={{
                              background: "oklch(1 0 0 / 0.06)",
                              border: `1px solid ${errors.name ? "oklch(0.65 0.2 25)" : "oklch(1 0 0 / 0.1)"}`,
                            }}
                          />
                          {errors.name && <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.2 25)" }}>{errors.name}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                            style={{ color: "oklch(1 0 0 / 0.35)" }}>
                            Work Email *
                          </label>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="jane@yourcompany.com"
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                            style={{
                              background: "oklch(1 0 0 / 0.06)",
                              border: `1px solid ${errors.email ? "oklch(0.65 0.2 25)" : "oklch(1 0 0 / 0.1)"}`,
                            }}
                          />
                          {errors.email && <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.2 25)" }}>{errors.email}</p>}
                        </div>
                      </div>

                      {/* Company + Unit Count */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                            style={{ color: "oklch(1 0 0 / 0.35)" }}>
                            Company / Association Name *
                          </label>
                          <input
                            type="text"
                            value={form.companyName}
                            onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))}
                            placeholder="Skyline Property Management"
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                            style={{
                              background: "oklch(1 0 0 / 0.06)",
                              border: `1px solid ${errors.companyName ? "oklch(0.65 0.2 25)" : "oklch(1 0 0 / 0.1)"}`,
                            }}
                          />
                          {errors.companyName && <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.2 25)" }}>{errors.companyName}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                            style={{ color: "oklch(1 0 0 / 0.35)" }}>
                            Total Units Managed *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.unitCount}
                            onChange={(e) => setForm(f => ({ ...f, unitCount: e.target.value }))}
                            placeholder="e.g. 120"
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                            style={{
                              background: "oklch(1 0 0 / 0.06)",
                              border: `1px solid ${errors.unitCount ? "oklch(0.65 0.2 25)" : "oklch(1 0 0 / 0.1)"}`,
                            }}
                          />
                          {errors.unitCount && <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.2 25)" }}>{errors.unitCount}</p>}
                        </div>
                      </div>

                      {/* Current Software */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                          style={{ color: "oklch(1 0 0 / 0.35)" }}>
                          Current Software (optional)
                        </label>
                        <input
                          type="text"
                          value={form.currentSoftware}
                          onChange={(e) => setForm(f => ({ ...f, currentSoftware: e.target.value }))}
                          placeholder="e.g. AppFolio, Buildium, spreadsheets, none"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                          style={{
                            background: "oklch(1 0 0 / 0.06)",
                            border: "1px solid oklch(1 0 0 / 0.1)",
                          }}
                        />
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                          style={{ color: "oklch(1 0 0 / 0.35)" }}>
                          Anything else? (optional)
                        </label>
                        <textarea
                          rows={3}
                          value={form.message}
                          onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                          placeholder="Tell us about your biggest operational challenge..."
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all resize-none"
                          style={{
                            background: "oklch(1 0 0 / 0.06)",
                            border: "1px solid oklch(1 0 0 / 0.1)",
                          }}
                        />
                      </div>

                      {errors.submit && (
                        <p className="text-sm text-center" style={{ color: "oklch(0.65 0.2 25)" }}>
                          {errors.submit}
                        </p>
                      )}

                      <Button
                        type="submit"
                        disabled={submitLead.isPending}
                        className="w-full font-semibold text-white flex items-center justify-center gap-2"
                        style={{
                          background: "oklch(0.72 0.15 185)",
                          height: "52px",
                          fontSize: "15px",
                        }}
                      >
                        {submitLead.isPending ? (
                          <span className="opacity-70">Submitting...</span>
                        ) : (
                          <>Request Private Access <ArrowRight className="w-4 h-4" /></>
                        )}
                      </Button>

                      <p className="text-center text-xs" style={{ color: "oklch(1 0 0 / 0.25)" }}>
                        No commitment required. Our team will respond within one business day.
                      </p>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="p-10 flex flex-col items-center text-center"
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                      style={{ background: "oklch(0.72 0.15 185 / 0.15)", border: "1px solid oklch(0.72 0.15 185 / 0.3)" }}>
                      <CheckCircle2 className="w-8 h-8" style={{ color: "oklch(0.72 0.15 185)" }} />
                    </div>
                    <h2 className="font-serif font-bold text-white mb-3"
                      style={{ fontSize: "clamp(1.4rem, 3vw, 1.8rem)" }}>
                      Request Received
                    </h2>
                    <p className="text-base leading-relaxed mb-8 max-w-sm"
                      style={{ color: "oklch(1 0 0 / 0.45)" }}>
                      Thank you. Our team will review your request and reach out within one business day to discuss your community's operational needs.
                    </p>
                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
                      {[
                        { icon: Building2, label: "Community review" },
                        { icon: Users,     label: "Team introduction" },
                        { icon: Layers,    label: "Deployment scoping" },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-3"
                          style={{ background: "oklch(1 0 0 / 0.04)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
                          <Icon className="w-4 h-4" style={{ color: "oklch(0.72 0.15 185)" }} />
                          <p className="text-[10px] text-center leading-tight" style={{ color: "oklch(1 0 0 / 0.4)" }}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleClose}
                      className="font-semibold text-white"
                      style={{ background: "oklch(0.72 0.15 185)", height: "48px", padding: "0 2.5rem" }}
                    >
                      Close
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
