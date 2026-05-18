import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, Building2 } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function AcceptInvitePage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const accept = trpc.invitations.accept.useMutation({
    onSuccess: () => {
      setStatus("success");
      setMessage("Invitation accepted! Redirecting to your dashboard...");
      setTimeout(() => navigate("/dashboard"), 2000);
    },
    onError: e => {
      setStatus("error");
      setMessage(e.message);
    },
  });

  const handleAccept = () => {
    if (!token) return;
    setStatus("loading");
    accept.mutate({ token });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">You've been invited</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You've been invited to join Stellar Property Management. Accept your invitation to get started.
        </p>

        {status === "idle" && token && (
          <button
            onClick={handleAccept}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Accept Invitation
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center justify-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className="flex items-center justify-center gap-2 text-red-400 mb-4">
              <XCircle className="w-5 h-5" />
              <span className="text-sm">{message}</span>
            </div>
            <a href={getLoginUrl()} className="text-sm text-primary hover:underline">
              Go to login
            </a>
          </div>
        )}

        {!token && status === "idle" && (
          <p className="text-sm text-red-400">Invalid or missing invitation token.</p>
        )}
      </div>
    </div>
  );
}
