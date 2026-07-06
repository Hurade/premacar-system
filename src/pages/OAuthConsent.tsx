import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Minimal typed shim for the beta supabase.auth.oauth namespace
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function getOAuth(): OAuthApi | null {
  const anyAuth = (supabase.auth as unknown as { oauth?: OAuthApi });
  return anyAuth.oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const oauth = getOAuth();
      if (!oauth) return setError("OAuth API not available on this Supabase client.");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }

      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuth();
    if (!oauth) return setError("OAuth API not available on this Supabase client.");
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Não foi possível carregar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "um aplicativo";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Conectar {clientName} à sua conta PremaCar
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {clientName} poderá acessar seus dados no PremaCar (contatos, negócios e campanhas) em seu
          nome via MCP. Você pode revogar o acesso a qualquer momento.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => decide(true)} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aprovar
          </Button>
          <Button
            variant="ghost"
            onClick={() => decide(false)}
            disabled={busy}
            className="w-full"
          >
            Negar
          </Button>
        </div>
      </div>
    </main>
  );
}
