
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_STATES = ['SC','MA','AP','RR','AC','MS','SE','TO','RO','AL','PI','RN','PB','AM','ES','DF','PA','MT','GO','CE','PE','BA','RS','PR','MG','RJ','SP'];
const DEFAULT_BATCH_SIZE = 12000;
const MAX_BATCH_SIZE = 30000;
const DEFAULT_MAX_RUNTIME_MS = 140000;
const MAX_MAX_RUNTIME_MS = 145000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let targetState: string | null = null;
    let requestedBatchSize: number | null = null;
    let requestedMaxRuntimeMs: number | null = null;

    try {
      const body = await req.json();
      targetState = typeof body?.estado === "string" ? body.estado.trim().toUpperCase() : null;
      requestedBatchSize = Number.isFinite(body?.batchSize) ? Number(body.batchSize) : null;
      requestedMaxRuntimeMs = Number.isFinite(body?.maxRuntimeMs) ? Number(body.maxRuntimeMs) : null;
    } catch {
      // no body
    }

    const batchSize = Math.max(3000, Math.min(requestedBatchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE));
    const maxRuntimeMs = Math.max(30000, Math.min(requestedMaxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS, MAX_MAX_RUNTIME_MS));
    const estados = targetState ? [targetState] : DEFAULT_STATES;

    let grandTotal = 0;
    const startTime = Date.now();

    for (const estado of estados) {
      if (Date.now() - startTime > maxRuntimeMs) break;

      let stateTotal = 0;

      for (let i = 0; i < 500; i++) {
        if (Date.now() - startTime > maxRuntimeMs) break;

        const { data, error } = await supabase.rpc('populate_search_vector_batch', {
          p_estado: estado,
          p_batch_size: batchSize,
        });

        if (error) {
          console.error(`Error ${estado}:`, error.message);
          break;
        }

        const updated = Number(data ?? 0);
        stateTotal += updated;
        grandTotal += updated;

        if (updated < batchSize) break;
      }

      if (stateTotal > 0) {
        console.log(`${estado}: +${stateTotal} (grand total: ${grandTotal}, batch: ${batchSize}, runtime_ms: ${Date.now() - startTime})`);
      }
    }

    return new Response(JSON.stringify({ success: true, total: grandTotal, batchSize, maxRuntimeMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
