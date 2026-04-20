
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

    const estados = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
    
    const results: Record<string, number> = {};
    let grandTotal = 0;

    for (const estado of estados) {
      let stateTotal = 0;
      let keepGoing = true;

      while (keepGoing) {
        const { data, error } = await supabase.rpc('populate_search_vector_batch', {
          p_estado: estado,
          p_batch_size: 50000
        });

        if (error) {
          console.error(`Error for ${estado}:`, error.message);
          keepGoing = false;
        } else {
          const updated = data as number;
          stateTotal += updated;
          grandTotal += updated;
          console.log(`${estado}: +${updated} (state total: ${stateTotal}, grand total: ${grandTotal})`);
          if (updated === 0) keepGoing = false;
        }
      }

      results[estado] = stateTotal;
    }

    return new Response(JSON.stringify({ success: true, total: grandTotal, by_state: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
