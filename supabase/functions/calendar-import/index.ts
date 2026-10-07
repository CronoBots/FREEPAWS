// Edge Function `calendar-import` : lit les agendas personnels de l'administratrice (adresse iCal
// secrète, ex. Google Agenda) et les enregistre comme indisponibilités (M1-02, synchro dans les
// deux sens avec `calendar-feed`).
//
// Appelée toutes les 15 minutes par pg_cron (voir docs/NOTIFICATIONS.md), avec l'en-tête
// `Authorization: Bearer <NOTIFY_CRON_SECRET>`.
//
// Les événements « disponible » (TRANSP:TRANSPARENT) et annulés sont ignorés ; les événements
// récurrents sont développés sur la période réservable (400 jours au plus).
import { createClient } from "npm:@supabase/supabase-js@2";

import { parseBusy } from "./parse.ts";

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_CRON_SECRET") ?? "";
  const given = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !constantTimeEqual(given, secret)) return new Response("forbidden", { status: 403 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("server_misconfigured", { status: 500 });
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: feeds, error } = await db.from("calendar_feeds").select("id, url").eq("active", true);
  if (error) return new Response("error", { status: 500 });

  const results: Record<string, number | string> = {};
  for (const feed of feeds ?? []) {
    try {
      const url = feed.url.replace(/^webcal:\/\//i, "https://");
      const response = await fetch(url, { headers: { Accept: "text/calendar" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const busy = parseBusy(await response.text());
      const { data: count, error: rpcError } = await db.rpc("replace_external_busy", {
        p_feed_id: feed.id,
        p_events: busy,
      });
      if (rpcError) throw new Error(rpcError.message);
      results[feed.id] = count ?? 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.rpc("replace_external_busy", { p_feed_id: feed.id, p_events: [], p_error: message });
      results[feed.id] = message;
    }
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
