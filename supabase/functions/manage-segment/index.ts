// Admin-only: gerencia segmentos (ler termos efetivos, editar, sugerir via IA, histórico).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { baseTermsFor, mergeWithOverride, normalizeKey } from "../_shared/segment-overrides.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function callAi(prompt: string, system: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("Limite de IA atingido. Tente em alguns minutos.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados.");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const label: string = body.label || "";
    const key = normalizeKey(label.split(",")[0]);

    const fetchOverride = async () => {
      const { data } = await admin.from("segment_overrides").select("*").eq("segment_key", key).maybeSingle();
      return data;
    };

    const recordChange = async (change_type: string, term: string | null, details: any = {}) => {
      await admin.from("segment_changes").insert({
        segment_key: key,
        change_type,
        term,
        details,
        changed_by: user.id,
        changed_by_email: user.email,
      });
    };

    if (action === "get") {
      const base = baseTermsFor(label);
      const ov = await fetchOverride();
      const effective = mergeWithOverride(base, ov);
      const { data: history } = await admin.from("segment_changes").select("*").eq("segment_key", key).order("created_at", { ascending: false }).limit(50);
      const { data: suggestions } = await admin.from("segment_suggestions").select("*").eq("segment_key", key).order("generated_at", { ascending: false }).limit(100);
      return json({ key, label, base, override: ov, effective, history: history || [], suggestions: suggestions || [] });
    }

    if (action === "add_term") {
      const term = (body.term || "").trim();
      if (!term) return json({ error: "term obrigatório" }, 400);
      const ov = await fetchOverride();
      const added = new Set([...(ov?.added_terms || []), term]);
      const removed = (ov?.removed_terms || []).filter((t: string) => t.toLowerCase() !== term.toLowerCase());
      await admin.from("segment_overrides").upsert({
        segment_key: key, segment_label: label,
        added_terms: Array.from(added), removed_terms: removed, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "segment_key" });
      await recordChange("add_term", term);
      return json({ ok: true });
    }

    if (action === "remove_term") {
      const term = (body.term || "").trim();
      if (!term) return json({ error: "term obrigatório" }, 400);
      const ov = await fetchOverride();
      const base = baseTermsFor(label);
      const isBase = base.some(t => t.toLowerCase() === term.toLowerCase());
      let added = (ov?.added_terms || []);
      let removed = ov?.removed_terms || [];
      if (isBase) {
        if (!removed.some((t: string) => t.toLowerCase() === term.toLowerCase())) removed = [...removed, term];
      } else {
        added = added.filter((t: string) => t.toLowerCase() !== term.toLowerCase());
      }
      await admin.from("segment_overrides").upsert({
        segment_key: key, segment_label: label,
        added_terms: added, removed_terms: removed, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "segment_key" });
      await recordChange("remove_term", term);
      return json({ ok: true });
    }

    if (action === "restore_term") {
      const term = (body.term || "").trim();
      const ov = await fetchOverride();
      if (!ov) return json({ ok: true });
      const removed = (ov.removed_terms || []).filter((t: string) => t.toLowerCase() !== term.toLowerCase());
      const added = (ov.added_terms || []).filter((t: string) => t.toLowerCase() !== term.toLowerCase());
      await admin.from("segment_overrides").update({ removed_terms: removed, added_terms: added, updated_by: user.id, updated_at: new Date().toISOString() }).eq("segment_key", key);
      await recordChange("restore_term", term);
      return json({ ok: true });
    }

    if (action === "reset") {
      await admin.from("segment_overrides").delete().eq("segment_key", key);
      await recordChange("reset", null);
      return json({ ok: true });
    }

    if (action === "suggest") {
      const base = baseTermsFor(label);
      const ov = await fetchOverride();
      const current = mergeWithOverride(base, ov);
      const sys = `Você é especialista em prospecção B2B no Brasil. Para o segmento informado, sugira termos de busca que apareçam em nomes fantasia/razão social de empresas brasileiras desse nicho — incluindo sinônimos, regionalismos, variações com/sem acento, plural/singular, e nomes comerciais comuns. Também identifique termos atuais que sejam ruins (ambíguos ou que tragam empresas erradas).
Responda SOMENTE em JSON com este formato:
{"add":[{"term":"...","rationale":"..."}], "remove":[{"term":"...","rationale":"..."}]}
Máximo 15 em add e 5 em remove. Sem texto extra.`;
      const prompt = `Segmento: "${label}"\nTermos atuais (${current.length}): ${current.slice(0, 80).join(", ")}`;
      const raw = await callAi(prompt, sys);
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }
      const adds = Array.isArray(parsed.add) ? parsed.add : [];
      const rems = Array.isArray(parsed.remove) ? parsed.remove : [];
      const lowerCurrent = new Set(current.map(t => t.toLowerCase()));
      const rows: any[] = [];
      for (const a of adds) {
        const t = String(a.term || "").trim();
        if (t && !lowerCurrent.has(t.toLowerCase())) rows.push({ segment_key: key, segment_label: label, suggestion_type: "add", term: t, rationale: String(a.rationale || "").slice(0, 500) });
      }
      for (const r of rems) {
        const t = String(r.term || "").trim();
        if (t && lowerCurrent.has(t.toLowerCase())) rows.push({ segment_key: key, segment_label: label, suggestion_type: "remove", term: t, rationale: String(r.rationale || "").slice(0, 500) });
      }
      // limpa sugestões pendentes antigas para não acumular
      await admin.from("segment_suggestions").delete().eq("segment_key", key).eq("status", "pending");
      if (rows.length) await admin.from("segment_suggestions").insert(rows);
      return json({ ok: true, generated: rows.length });
    }

    if (action === "decide_suggestion") {
      const sid: string = body.id;
      const decision: string = body.decision; // accepted | rejected
      if (!sid || !["accepted", "rejected"].includes(decision)) return json({ error: "params" }, 400);
      const { data: sug } = await admin.from("segment_suggestions").select("*").eq("id", sid).maybeSingle();
      if (!sug) return json({ error: "not found" }, 404);
      await admin.from("segment_suggestions").update({ status: decision, decided_at: new Date().toISOString(), decided_by: user.id }).eq("id", sid);
      if (decision === "accepted") {
        const ov = await fetchOverride();
        if (sug.suggestion_type === "add") {
          const added = new Set([...(ov?.added_terms || []), sug.term]);
          await admin.from("segment_overrides").upsert({
            segment_key: sug.segment_key, segment_label: sug.segment_label,
            added_terms: Array.from(added), removed_terms: ov?.removed_terms || [],
            updated_by: user.id, updated_at: new Date().toISOString(),
          }, { onConflict: "segment_key" });
        } else {
          const removed = new Set([...(ov?.removed_terms || []), sug.term]);
          await admin.from("segment_overrides").upsert({
            segment_key: sug.segment_key, segment_label: sug.segment_label,
            added_terms: (ov?.added_terms || []).filter((t: string) => t.toLowerCase() !== sug.term.toLowerCase()),
            removed_terms: Array.from(removed),
            updated_by: user.id, updated_at: new Date().toISOString(),
          }, { onConflict: "segment_key" });
        }
        await recordChange("ai_accept", sug.term, { suggestion_type: sug.suggestion_type });
      }
      return json({ ok: true });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("manage-segment error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
