
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
    const { estado, batch_size = 50000 } = await req.json();
    
    if (!estado) {
      return new Response(JSON.stringify({ error: "estado is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let total = 0;
    let keepGoing = true;

    while (keepGoing) {
      const { data, error } = await supabase.rpc('populate_search_vector_batch', {
        p_estado: estado,
        p_batch_size: batch_size
      });

      if (error) {
        console.error(`Error for ${estado}:`, error.message);
        return new Response(JSON.stringify({ error: error.message, processed_so_far: total }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updated = data as number;
      total += updated;
      console.log(`${estado}: +${updated} (total: ${total})`);
      if (updated === 0) keepGoing = false;
    }

    return new Response(JSON.stringify({ success: true, estado, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
