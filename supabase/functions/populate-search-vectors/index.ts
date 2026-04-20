
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      targetState = body?.estado || null;
    } catch { /* no body */ }

    // Process smallest states first
    const estados = targetState 
      ? [targetState]
      : ['SC','AP','RR','AC','MS','SE','TO','RO','AL','PI','RN','PB','AM','ES','MA','DF','PA','MT','GO','CE','PE','BA','RS','PR','MG','RJ','SP'];
    
    let grandTotal = 0;
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 45000; // 45s

    for (const estado of estados) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;

      let stateTotal = 0;
      // Many small batches of 500
      for (let i = 0; i < 200; i++) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        const { data, error } = await supabase.rpc('populate_search_vector_batch', {
          p_estado: estado,
          p_batch_size: 500
        });

        if (error) {
          console.error(`Error ${estado}:`, error.message);
          break;
        }

        const updated = data as number;
        stateTotal += updated;
        grandTotal += updated;
        
        if (updated === 0) break;
      }

      if (stateTotal > 0) {
        console.log(`${estado}: +${stateTotal} (grand total: ${grandTotal})`);
      }
    }

    return new Response(JSON.stringify({ success: true, total: grandTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
