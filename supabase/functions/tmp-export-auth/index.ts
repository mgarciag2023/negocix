// TEMPORARY export helper (read-only). Deleted right after the backup is generated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TOKEN = "b7f2c1a9-export-negocix-2026";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const table = url.searchParams.get("table") ?? "users";
  const page = Number(url.searchParams.get("page") ?? "1");

  if (table === "dump") {
    const { data, error } = await admin.rpc("tmp_export_auth_dump");
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  }

  if (table === "users") {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data.users), { headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: "unknown table" }), { status: 400 });
});
