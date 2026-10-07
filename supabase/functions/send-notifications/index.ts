// Edge Function `send-notifications` : envoie les emails de la file public.notifications
// (confirmation, report, annulation, rappel, alertes à l'administratrice).
//
// Appelée chaque minute par pg_cron (voir docs/NOTIFICATIONS.md) avec l'en-tête
// `Authorization: Bearer <NOTIFY_CRON_SECRET>`. Les lignes sont réclamées par
// claim_notifications() : pas de double envoi entre deux exécutions, 5 tentatives au plus.
//
// Variables d'environnement (secrets Supabase) :
//   RESEND_API_KEY      clé de l'API Resend (https://resend.com), domaine expéditeur vérifié
//   NOTIFY_FROM         ex. FreePaws <reservations@freepaws.be>
//   NOTIFY_CRON_SECRET  secret partagé avec la tâche pg_cron
//   RESEND_API_URL      (optionnel, tests) autre adresse d'envoi que l'API Resend
import { createClient } from "npm:@supabase/supabase-js@2";

type Lang = "fr" | "en";
type Kind =
  | "booking_confirmed"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "booking_reminder"
  | "admin_new_booking"
  | "admin_booking_rescheduled"
  | "admin_booking_cancelled";

type BookingRow = {
  id: string;
  status: string;
  client_id: string;
  client_notes: string | null;
  visit_address: string | null;
  adults_count: number | null;
  children_count: number | null;
  dogs_count: number | null;
  party_size: number;
  appointment: {
    period: string;
    service: {
      name: string;
      location: string;
      translations: Record<string, Record<string, string>> | null;
      cancel_notice_hours: number;
      required_document_kinds: string[];
    } | null;
  } | null;
  client: { email: string; full_name: string; phone: string | null; language: string } | null;
};
type AcceptanceRow = { document: { kind: string; version: number; title: string; body: string } | null };

/** Textes des emails. Uniquement des formulations transactionnelles, aucun contenu commercial. */
const TEXT = {
  fr: {
    booking_confirmed: ["Réservation confirmée", "Votre réservation est confirmée."],
    booking_rescheduled: ["Réservation déplacée", "Votre réservation a été déplacée."],
    booking_cancelled: ["Réservation annulée", "Votre réservation a été annulée."],
    booking_reminder: ["Rappel de votre rendez-vous", "Petit rappel de votre prochain rendez-vous FreePaws."],
    when: "Quand",
    where: "Où",
    address: "Adresse de la visite",
    cancelPolicy: (h: number) => `Annulation ou report possible jusqu’à ${h} h avant le rendez-vous, depuis l’app.`,
    documents: "Documents acceptés",
    version: (v: number) => `version ${v}`,
    footer: "Cet email vous est envoyé suite à une réservation dans l’app FreePaws.",
  },
  en: {
    booking_confirmed: ["Booking confirmed", "Your booking is confirmed."],
    booking_rescheduled: ["Booking moved", "Your booking has been moved."],
    booking_cancelled: ["Booking cancelled", "Your booking has been cancelled."],
    booking_reminder: ["Appointment reminder", "A quick reminder of your next FreePaws appointment."],
    when: "When",
    where: "Where",
    address: "Visit address",
    cancelPolicy: (h: number) => `You can cancel or reschedule up to ${h} h before the appointment, in the app.`,
    documents: "Accepted documents",
    version: (v: number) => `version ${v}`,
    footer: "You are receiving this email following a booking in the FreePaws app.",
  },
} as const;

const ADMIN_SUBJECT: Record<string, string> = {
  admin_new_booking: "Nouvelle réservation",
  admin_booking_rescheduled: "Réservation déplacée",
  admin_booking_cancelled: "Réservation annulée",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function parseRange(range: string): [Date, Date] {
  const [start, end] = range
    .replace(/^[[(]"?|"?[\])]$/g, "")
    .split(/"?,"?/)
    .map((v) => new Date(v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")));
  return [start!, end!];
}

function formatWhen([start, end]: [Date, Date], lang: Lang) {
  const locale = lang === "fr" ? "fr-BE" : "en-GB";
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat(locale, { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day}, ${time.format(start)} – ${time.format(end)}`;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function layout(title: string, rows: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:Helvetica,Arial,sans-serif;color:#1f1d1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b7a3a;margin:0 0 8px">FreePaws</p>
<h1 style="font-family:Georgia,serif;font-weight:600;font-size:26px;margin:0 0 20px">${escapeHtml(title)}</h1>
${rows}
</div></body></html>`;
}

const p = (text: string) => `<p style="font-size:16px;line-height:1.5;margin:0 0 14px">${escapeHtml(text)}</p>`;
const field = (label: string, value: string) =>
  `<p style="font-size:16px;line-height:1.5;margin:0 0 10px"><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`;

Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_CRON_SECRET") ?? "";
  const given = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !constantTimeEqual(given, secret)) return new Response("forbidden", { status: 403 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM");
  // Sans fournisseur d'email, on laisse la file intacte (rien n'est réclamé ni perdu).
  if (!supabaseUrl || !serviceKey || !resendKey || !from) return new Response("not_configured", { status: 503 });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: settings } = await db.from("settings").select("admin_email").single();
  const { data: claimed, error } = await db.rpc("claim_notifications", { p_limit: 25 });
  if (error) return new Response("error", { status: 500 });

  let sent = 0;
  for (const notification of claimed ?? []) {
    try {
      const { data, error: bookingError } = await db
        .from("bookings")
        .select(
          `id, status, client_id, client_notes, visit_address, adults_count, children_count, dogs_count, party_size,
           appointment:appointments ( period,
             service:services ( name, location, translations, cancel_notice_hours, required_document_kinds ) ),
           client:profiles!bookings_client_id_fkey ( email, full_name, phone, language )`,
        )
        .eq("id", notification.booking_id)
        .single();
      const booking = data as unknown as BookingRow | null;
      if (bookingError || !booking?.appointment?.service || !booking.client) throw new Error("booking_not_found");

      // Réservation annulée entre-temps : seul l'email d'annulation reste pertinent.
      if (booking.status === "cancelled" && !notification.kind.endsWith("cancelled")) {
        await db.from("notifications").update({ sent_at: new Date().toISOString(), last_error: "skipped" }).eq("id", notification.id);
        continue;
      }

      const service = booking.appointment.service;
      const period = parseRange(String(booking.appointment.period));
      const kind = notification.kind as Kind;
      let to: string;
      let subject: string;
      let html: string;

      if (notification.audience === "admin") {
        if (!settings?.admin_email) throw new Error("admin_email_missing");
        to = settings.admin_email;
        subject = `${ADMIN_SUBJECT[kind]} · ${service.name}`;
        const c = booking.client;
        html = layout(
          ADMIN_SUBJECT[kind]!,
          [
            field("Prestation", service.name),
            field("Quand", formatWhen(period, "fr")),
            field("Client", [c.full_name, c.email, c.phone].filter(Boolean).join(" · ")),
            booking.visit_address ? field("Adresse de la visite", booking.visit_address) : "",
            field(
              "Participants",
              [
                booking.adults_count != null ? `adultes : ${booking.adults_count}` : null,
                booking.children_count != null ? `enfants : ${booking.children_count}` : null,
                booking.dogs_count != null ? `chiens : ${booking.dogs_count}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || String(booking.party_size),
            ),
            booking.client_notes ? field("Message", booking.client_notes) : "",
          ].join(""),
        );
      } else {
        const lang: Lang = booking.client.language === "en" ? "en" : "fr";
        const t = TEXT[lang];
        const localized = lang === "fr" ? {} : (service.translations?.[lang] ?? {});
        const name = localized.name || service.name;
        const location = localized.location || service.location;
        const [title, intro] = t[kind as keyof typeof t] as readonly [string, string];
        to = booking.client.email;
        subject = `${title} · ${name}`;

        let documents = "";
        if (kind === "booking_confirmed" && service.required_document_kinds?.length) {
          // Copie des documents acceptés (dernière version acceptée de chaque type requis).
          const { data: acceptedData } = await db
            .from("document_acceptances")
            .select("accepted_at, document:legal_documents ( kind, version, title, body )")
            .eq("user_id", booking.client_id);
          const accepted = acceptedData as unknown as AcceptanceRow[] | null;
          const latest = new Map<string, { version: number; title: string; body: string }>();
          for (const row of accepted ?? []) {
            const d = row.document;
            if (!d || !service.required_document_kinds.includes(d.kind)) continue;
            if ((latest.get(d.kind)?.version ?? 0) < d.version) latest.set(d.kind, d);
          }
          if (latest.size > 0) {
            documents =
              `<h2 style="font-family:Georgia,serif;font-size:20px;margin:28px 0 12px">${escapeHtml(t.documents)}</h2>` +
              [...latest.values()]
                .map(
                  (d) =>
                    `<h3 style="font-size:16px;margin:16px 0 6px">${escapeHtml(d.title)} (${escapeHtml(t.version(d.version))})</h3>` +
                    d.body
                      .split(/\n{2,}/)
                      .map((para) => p(para))
                      .join(""),
                )
                .join("");
          }
        }

        html = layout(
          title,
          [
            p(intro),
            field(lang === "fr" ? "Prestation" : "Service", name),
            field(t.when, formatWhen(period, lang)),
            booking.visit_address
              ? field(t.address, booking.visit_address)
              : location
                ? field(t.where, location)
                : "",
            kind === "booking_cancelled" ? "" : p(t.cancelPolicy(service.cancel_notice_hours)),
            documents,
            `<p style="font-size:13px;color:#6f6a60;margin:28px 0 0">${escapeHtml(t.footer)}</p>`,
          ].join(""),
        );
      }

      if (!to) throw new Error("recipient_missing");
      const response = await fetch(Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (!response.ok) throw new Error(`resend_${response.status}`);

      await db.from("notifications").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", notification.id);
      sent++;
    } catch (err) {
      await db
        .from("notifications")
        .update({ last_error: String(err instanceof Error ? err.message : err).slice(0, 500) })
        .eq("id", notification.id);
    }
  }

  return new Response(JSON.stringify({ claimed: claimed?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
