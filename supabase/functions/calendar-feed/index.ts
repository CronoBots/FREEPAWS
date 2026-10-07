// Edge Function `calendar-feed` : agenda FreePaws au format iCalendar (.ics), pour s'y abonner
// depuis Google Agenda, Apple Calendrier ou Outlook (synchronisation vers l'agenda externe, M1-02).
//
// URL : <projet>/functions/v1/calendar-feed?token=<settings.calendar_token>
// Le jeton est secret (visible par l'administratrice dans l'app) ; le changer coupe les anciens abonnements.
import { createClient } from "npm:@supabase/supabase-js@2";

const DAYS_BACK = 30;
const DAYS_AHEAD = 365;

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Échappe le texte et replie les lignes à 75 octets (RFC 5545). */
function line(name: string, value: string) {
  const escaped = value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
  const full = `${name}:${escaped}`;
  const out: string[] = [];
  let current = "";
  for (const char of full) {
    if (new TextEncoder().encode(current + char).length > 74) {
      out.push(current);
      current = " ";
    }
    current += char;
  }
  out.push(current);
  return out.join("\r\n");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("server_misconfigured", { status: 500 });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: settings } = await db.from("settings").select("calendar_token").single();
  if (!settings || !token || !constantTimeEqual(token, settings.calendar_token)) {
    return new Response("forbidden", { status: 403 });
  }

  const from = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
  const to = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString();
  const { data: appointments, error } = await db
    .from("appointments")
    .select(
      `id, period, updated_at,
       service:services ( name ),
       bookings ( status, visit_address, children_count, dogs_count, client_notes,
                  client:profiles!bookings_client_id_fkey ( full_name, phone ) )`,
    )
    .eq("status", "scheduled")
    .overlaps("period", `[${from},${to})`);
  if (error) return new Response("error", { status: 500 });

  const events = (appointments ?? []).map((appointment) => {
    const [start, end] = String(appointment.period)
      .replace(/^[[(]"?|"?[\])]$/g, "")
      .split(/"?,"?/)
      .map((v) => v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
    const confirmed = (appointment.bookings ?? []).filter((b) => b.status === "confirmed");
    const who = confirmed.map((b) => b.client?.full_name || "Client").join(", ");
    const address = confirmed.find((b) => b.visit_address)?.visit_address ?? "";
    const details = confirmed
      .map((b) =>
        [
          b.client?.full_name,
          b.client?.phone,
          b.children_count != null ? `enfants : ${b.children_count}` : null,
          b.dogs_count != null ? `chiens : ${b.dogs_count}` : null,
          b.client_notes,
        ]
          .filter(Boolean)
          .join(" · "),
      )
      .join("\n");
    return [
      "BEGIN:VEVENT",
      `UID:${appointment.id}@freepaws`,
      `DTSTAMP:${icsDate(appointment.updated_at)}`,
      `DTSTART:${icsDate(start!)}`,
      `DTEND:${icsDate(end!)}`,
      line("SUMMARY", `${appointment.service?.name ?? "FreePaws"}${who ? ` — ${who}` : ""}`),
      address ? line("LOCATION", address) : null,
      details ? line("DESCRIPTION", details) : null,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FreePaws//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:FreePaws",
    "X-WR-TIMEZONE:Europe/Brussels",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
});
