
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

    // Parse optional state filter
    let targetState: string | null = null;
    try {
      const body = await req.json();
      targetState = body?.estado || null;
    } catch { /* no body */ }

    const estados = targetState 
      ? [targetState]
      : ['AP','MS','SE','TO','RO','AL','PI','RN','PB','AM','ES','MA','DF','PA','MT','GO','CE','PE','BA','SC','RS','PR','MG','RJ','SP'];
    
    let grandTotal = 0;
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 25000; // 25 seconds to stay under gateway timeout

    for (const estado of estados) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;

      const { data, error } = await supabase.rpc('populate_search_vector_batch', {
        p_estado: estado,
        p_batch_size: 5000
      });

      if (error) {
        console.error(`Error ${estado}:`, error.message);
        continue;
      }

      const updated = data as number;
      grandTotal += updated;
      
      if (updated > 0) {
        console.log(`${estado}: +${updated} (total: ${grandTotal})`);
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
