
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Order: smallest first for quick wins, then big states
const ALL_STATES = ['AM','ES','DF','PA','MT','GO','CE','PE','BA','RS','PR','MG','RJ','SP'];
const BATCH_SIZE = 40000;
const MAX_RUNTIME_MS = 145000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let targetState: string | null = null;
    try {
      const body = await req.json();
      targetState = typeof body?.estado === "string" ? body.estado.trim().toUpperCase() : null;
    } catch { /* no body */ }

    // If no specific state, pick one with pending work using round-robin
    const estados = targetState ? [targetState] : ALL_STATES;

    let grandTotal = 0;
    const startTime = Date.now();
    const stateResults: Record<string, number> = {};

    for (const estado of estados) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;

      let stateTotal = 0;

      for (let i = 0; i < 100; i++) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        const { data, error } = await supabase.rpc('populate_search_vector_batch', {
          p_estado: estado,
          p_batch_size: BATCH_SIZE,
        });

        if (error) {
          if (error.message.includes('lock timeout') || error.message.includes('canceling statement')) {
            // Skip to next state on lock conflict
            console.warn(`Lock conflict ${estado}, skipping`);
            break;
          }
          console.error(`Error ${estado}:`, error.message);
          break;
        }

        const updated = Number(data ?? 0);
        stateTotal += updated;
        grandTotal += updated;

        if (updated === 0) break; // state is done
        if (updated < BATCH_SIZE) break; // state nearly done
      }

      if (stateTotal > 0) {
        stateResults[estado] = stateTotal;
        console.log(`${estado}: +${stateTotal} (total: ${grandTotal}, ${Date.now() - startTime}ms)`);
      } else if (stateTotal === 0) {
        // State is done, no need to log
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`Done: ${grandTotal} rows in ${elapsed}ms across ${Object.keys(stateResults).length} states`);

    return new Response(JSON.stringify({ 
      success: true, 
      total: grandTotal, 
      elapsed_ms: elapsed,
      states: stateResults 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
