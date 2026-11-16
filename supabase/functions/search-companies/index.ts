import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const columns = "id,cnpj,razao_social,nome_fantasia,telefone_1,telefone_2,email,endereco,bairro,cidade,estado,cep,descricao_cnae,porte,matriz_filial,situacao_cadastral";
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Entre na sua conta." });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return reply(401, { error: "Entre na sua conta." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: blocked, error: blockedError } = await admin.rpc("is_user_blocked", { _user_id: user.id });
  if (blockedError || blocked !== false) return reply(403, { error: "Acesso indisponível para esta conta." });
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "Pesquisa inválida." });
    const { mode, name = "", cnpj = "", city = "", state = "" } = body;
    if (!["name", "cnpj", "location"].includes(mode) ||
      [name, cnpj, city, state].some(v => typeof v !== "string") ||
      name.length > 200 || cnpj.length > 30 || city.length > 100 ||
      (state !== "" && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state))) {
      return reply(400, { error: "Pesquisa inválida." });
    }
    const cityKey = city.trim().toUpperCase();
    let result;
    if (mode === "name") {
      if (!name.trim()) return reply(400, { error: "Digite um nome." });
      const terms = name.trim().split(/\s+/).slice(0, 5).map((t: string) => {
        const lower = t.toLowerCase();
        return lower.length > 4 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
      });
      result = await admin.rpc("search_companies_ilike", {
        p_city: cityKey || null, p_state: state || null, p_search_terms: terms,
        p_biz_type: "all", p_limit_val: 300, p_offset_val: 0,
      }).select(columns);
    } else {
      let query = admin.from("companies").select(columns);
      if (mode === "cnpj") {
        const digits = cnpj.replace(/\D/g, "");
        if (digits.length < 8 || digits.length > 14) return reply(400, { error: "CNPJ inválido." });
        query = query.ilike("cnpj", `%${digits}%`).limit(200);
      } else {
        if (!state && !cityKey) return reply(400, { error: "Informe estado ou cidade." });
        query = query.eq("situacao_cadastral", "ATIVA").limit(300);
      }
      if (state) query = query.eq("estado", state);
      if (cityKey) query = query.eq("cidade", cityKey);
      result = await query;
    }
    if (result.error) return reply(500, { error: "Não foi possível pesquisar. Tente novamente." });
    return reply(200, { results: result.data || [] });
  } catch {
    return reply(400, { error: "Não foi possível processar a pesquisa." });
  }
});