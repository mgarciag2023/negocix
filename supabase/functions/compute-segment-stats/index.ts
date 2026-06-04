// Calcula estatísticas e gera alertas para segmentos de negócio.
// Apenas admins podem invocar. Pode ser chamado para um único segmento ou para vários.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { categoryTerms } from "../_shared/category-terms.ts";

interface ComputeRequest {
  segments?: string[];   // labels (do customerTypes). Se vazio/ausente => "all"
  limitSegments?: number; // segurança: máx segmentos por chamada (default 30)
}

const COUNT_CAP = 50_000; // limite superior para a contagem (performance)
const SOFT_TIMEOUT_MS = 50_000;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function resolveTerms(label: string): string[] {
  const key = normalize(label.split(",")[0]);
  if (categoryTerms[key]) return categoryTerms[key];
  // Fallback: tenta achar por sufixo/prefixo
  const found = Object.keys(categoryTerms).find(k => k === key || k.includes(key) || key.includes(k));
  if (found) return categoryTerms[found];
  return [key]; // último recurso
}

function computeScore(termsCount: number, companiesCount: number): { score: number; status: string } {
  if (companiesCount === 0) return { score: 0, status: "critical" };
  let score = 0;
  // termos: até 40 pontos
  score += Math.min(40, termsCount * 4);
  // empresas: até 60 pontos (log scale)
  score += Math.min(60, Math.round(Math.log10(companiesCount + 1) * 15));
  score = Math.max(0, Math.min(100, score));
  let status: string;
  if (score >= 75) status = "healthy";
  else if (score >= 50) status = "warning";
  else status = "critical";
  return { score, status };
}

interface AlertDef {
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  reason: string;
  impact: string;
  action: string;
}

function deriveAlerts(termsCount: number, companiesCount: number): AlertDef[] {
  const alerts: AlertDef[] = [];
  if (companiesCount === 0) {
    alerts.push({
      type: "no_results",
      priority: "critical",
      reason: "Segmento não retorna empresas com os termos atuais.",
      impact: "Bloqueia totalmente a prospecção neste nicho.",
      action: "Revisar e adicionar termos mais comuns usados pelas empresas do segmento.",
    });
  } else if (companiesCount < 100) {
    alerts.push({
      type: "low_coverage",
      priority: "high",
      reason: `Apenas ${companiesCount} empresas encontradas — cobertura muito baixa.`,
      impact: "Poucas oportunidades de prospecção; usuários verão poucos leads.",
      action: "Adicionar sinônimos, variações regionais e termos relacionados.",
    });
  }
  if (termsCount < 3) {
    alerts.push({
      type: "few_terms",
      priority: "high",
      reason: `Apenas ${termsCount} termo(s) cadastrado(s).`,
      impact: "Recall limitado — empresas com nomes alternativos não serão encontradas.",
      action: "Adicionar pelo menos 6-10 sinônimos/variações.",
    });
  }
  if (termsCount >= 3 && termsCount < 6 && companiesCount > 0 && companiesCount < 500) {
    alerts.push({
      type: "expansion_opportunity",
      priority: "low",
      reason: "Cobertura média — há espaço para expandir termos e capturar mais leads.",
      impact: "Aumentar cobertura pode multiplicar leads disponíveis.",
      action: "Revisar concorrentes e adicionar 3-5 termos novos.",
    });
  }
  return alerts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const FUNCTION_START = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ===== Auth: precisa ser admin =====
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ===== Carrega lista de segmentos a processar =====
    const body: ComputeRequest = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(body.limitSegments ?? 30, 100);

    // Importa customerTypes do client? Não — não acessível aqui.
    // Estratégia: o caller (admin UI) envia a lista. Se não enviar, usa as chaves do categoryTerms.
    let labels: string[] = body.segments && body.segments.length > 0
      ? body.segments
      : Object.keys(categoryTerms);
    labels = labels.slice(0, limit);

    const results: any[] = [];
    for (const label of labels) {
      if (Date.now() - FUNCTION_START > SOFT_TIMEOUT_MS) {
        console.warn("⏱️ Soft timeout — bailing");
        break;
      }
      const terms = resolveTerms(label);
      const segmentKey = normalize(label);

      // Conta empresas via FTS index. Usa ts_query com OR entre os 6 primeiros termos
      // (limitar termos evita explosão do tsquery).
      const tsTerms = terms.slice(0, 6).map(t => t.replace(/[':!&|()]/g, " ").trim()).filter(Boolean);
      const tsQuery = tsTerms.length > 0
        ? tsTerms.map(t => t.split(/\s+/).join(" & ")).map(t => `(${t})`).join(" | ")
        : "";

      let companiesCount = 0;
      if (tsQuery) {
        try {
          // Usa head:true + count: 'planned' para ser rápido em índice
          const { count, error } = await admin
            .from("companies")
            .select("id", { count: "estimated", head: true })
            .eq("situacao_cadastral", "ATIVA")
            .textSearch("search_vector", tsQuery, { config: "portuguese" });
          if (!error && typeof count === "number") {
            companiesCount = Math.min(count, COUNT_CAP * 1000);
          }
        } catch (e) {
          console.warn(`count failed "${label}":`, (e as Error).message);
        }
      }

      const { score, status } = computeScore(terms.length, companiesCount);
      const alerts = deriveAlerts(terms.length, companiesCount);

      // Upsert stats
      await admin.from("segment_stats").upsert({
        segment_key: segmentKey,
        segment_label: label,
        terms_count: terms.length,
        companies_count: companiesCount,
        quality_score: score,
        status,
        alerts_count: alerts.length,
        last_computed_at: new Date().toISOString(),
      }, { onConflict: "segment_key" });

      // Limpa alertas antigos não-resolvidos deste segmento e insere os novos
      await admin.from("segment_alerts").delete().eq("segment_key", segmentKey).eq("resolved", false);
      if (alerts.length > 0) {
        await admin.from("segment_alerts").insert(
          alerts.map(a => ({
            segment_key: segmentKey,
            alert_type: a.type,
            priority: a.priority,
            reason: a.reason,
            impact: a.impact,
            recommended_action: a.action,
          }))
        );
      }

      results.push({ label, terms: terms.length, companies: companiesCount, score, status, alerts: alerts.length });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ compute-segment-stats error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
