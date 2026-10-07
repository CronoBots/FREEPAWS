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
  | "admin_booking_cancelled"
  | "insurance_expiring"
  | "vaccination_expiring"
  | "vaccination_reviewed"
  | "waitlist_slot_freed"
  | "admin_documents_expired"
  | "admin_vaccination_to_review"
  | "admin_emergency";

type NotificationRow = {
  id: string;
  kind: Kind;
  audience: "client" | "admin";
  booking_id: string | null;
  profile_id: string | null;
  dog_id: string | null;
  emergency_id: string | null;
  ref_date: string | null;
  payload: Record<string, unknown>;
};
type Email = { to: string; subject: string; html: string };

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

/** Messages hors réservation (échéances, vaccins, liste d'attente). */
const OTHER_TEXT = {
  fr: {
    insurance_expiring: (date: string) => [
      "Votre assurance arrive à échéance",
      `Votre assurance responsabilité civile enregistrée dans l’app FreePaws arrive à échéance le ${date}. Mettez à jour votre fiche (Compte → Mes informations) pour pouvoir continuer à réserver le parc.`,
    ],
    vaccination_expiring: (dog: string, vaccine: string, date: string) => [
      `Vaccin de ${dog} à renouveler`,
      `Le vaccin « ${vaccine} » de ${dog} arrive à échéance le ${date}. Ajoutez la nouvelle vaccination dans la fiche de votre chien pour pouvoir continuer à réserver le parc.`,
    ],
    vaccination_validated: (dog: string, vaccine: string) => [
      "Vaccination validée",
      `La vaccination « ${vaccine} » de ${dog} a été validée.`,
    ],
    vaccination_rejected: (dog: string, vaccine: string) => [
      "Vaccination non validée",
      `La vaccination « ${vaccine} » de ${dog} n’a pas pu être validée. Vérifiez le justificatif dans la fiche de votre chien.`,
    ],
    note: "Message",
    waitlist_slot_freed: (service: string, date: string) => [
      "Un créneau s’est libéré",
      `Un créneau s’est libéré le ${date} pour « ${service} ». Ouvrez l’app FreePaws pour le réserver ; le premier à confirmer l’obtient.`,
    ],
  },
  en: {
    insurance_expiring: (date: string) => [
      "Your insurance is about to expire",
      `The liability insurance saved in the FreePaws app expires on ${date}. Update your details (Account → My details) to keep booking the park.`,
    ],
    vaccination_expiring: (dog: string, vaccine: string, date: string) => [
      `${dog}’s vaccine needs renewing`,
      `${dog}’s “${vaccine}” vaccine expires on ${date}. Add the new vaccination to your dog’s profile to keep booking the park.`,
    ],
    vaccination_validated: (dog: string, vaccine: string) => [
      "Vaccination approved",
      `${dog}’s “${vaccine}” vaccination has been approved.`,
    ],
    vaccination_rejected: (dog: string, vaccine: string) => [
      "Vaccination not approved",
      `${dog}’s “${vaccine}” vaccination could not be approved. Please check the proof in your dog’s profile.`,
    ],
    note: "Message",
    waitlist_slot_freed: (service: string, date: string) => [
      "A slot is now available",
      `A slot is now available on ${date} for “${service}”. Open the FreePaws app to book it; first to confirm gets it.`,
    ],
  },
} as const;

function formatDay(isoDay: string, lang: Lang) {
  const [y, m, d] = isoDay.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-BE" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

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

const makeDb = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
type Db = ReturnType<typeof makeDb>;

/** Emails non liés à une réservation, et alerte d'urgence. Null = rien à envoyer. */
async function standaloneEmail(db: Db, n: NotificationRow, adminEmail: string | null): Promise<Email | null> {
  const footer = (lang: Lang) =>
    `<p style="font-size:13px;color:#6f6a60;margin:28px 0 0">${escapeHtml(
      lang === "fr" ? "Cet email vous est envoyé par l’app FreePaws." : "This email was sent by the FreePaws app.",
    )}</p>`;

  if (n.kind === "admin_emergency") {
    if (!adminEmail) throw new Error("admin_email_missing");
    const { data } = await db
      .from("emergencies")
      .select(
        `created_at, message,
         user:profiles!emergencies_user_id_fkey ( full_name, phone, email, emergency_contact_name, emergency_contact_phone ),
         booking:bookings ( adults_count, children_count, appointment:appointments ( period, service:services ( name ) ) )`,
      )
      .eq("id", n.emergency_id ?? "")
      .single();
    const e = data as unknown as {
      created_at: string;
      message: string | null;
      user: { full_name: string; phone: string | null; email: string; emergency_contact_name: string | null; emergency_contact_phone: string | null } | null;
      booking: { adults_count: number | null; children_count: number | null; appointment: { period: string; service: { name: string } | null } | null } | null;
    } | null;
    if (!e?.user) throw new Error("emergency_not_found");
    const period = e.booking?.appointment ? formatWhen(parseRange(String(e.booking.appointment.period)), "fr") : "";
    return {
      to: adminEmail,
      subject: `URGENCE · ${e.user.full_name || e.user.email}`,
      html: layout("Alerte urgence", [
        p("Une personne a appuyé sur le bouton « Urgence » de l’app. Rappelez-la immédiatement ; en cas de danger, appelez le 112."),
        field("Personne", [e.user.full_name, e.user.phone, e.user.email].filter(Boolean).join(" · ")),
        e.message ? field("Message", e.message) : "",
        period ? field("Créneau", `${e.booking?.appointment?.service?.name ?? ""} · ${period}`) : "",
        field("Contact d’urgence", [e.user.emergency_contact_name, e.user.emergency_contact_phone].filter(Boolean).join(" · ") || "—"),
        field("Heure de l’alerte", new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", dateStyle: "full", timeStyle: "medium" }).format(new Date(e.created_at))),
      ].join("")),
    };
  }

  if (n.audience === "admin") {
    if (!adminEmail) throw new Error("admin_email_missing");
    if (n.kind === "admin_documents_expired") {
      const count = Number(n.payload.count ?? 0);
      return {
        to: adminEmail,
        subject: "Documents arrivés à échéance",
        html: layout("Documents arrivés à échéance", p(`${count} assurance(s) ou vaccination(s) exigée(s) sont arrivées à échéance hier. Les clients concernés ne peuvent plus réserver le parc tant qu’ils n’ont pas mis leur fiche à jour.`)),
      };
    }
    if (n.kind === "admin_vaccination_to_review") {
      const { data } = await db.from("dogs").select("name, owner:profiles ( full_name, email )").eq("id", n.dog_id ?? "").single();
      const dog = data as unknown as { name: string; owner: { full_name: string; email: string } | null } | null;
      if (!dog) return null;
      return {
        to: adminEmail,
        subject: `Vaccination à valider · ${dog.name}`,
        html: layout("Vaccination à valider", [
          p("Une vaccination a été ajoutée ou modifiée. Vérifiez le justificatif dans l’app (Administration → Vaccinations à valider)."),
          field("Chien", dog.name),
          field("Propriétaire", [dog.owner?.full_name, dog.owner?.email].filter(Boolean).join(" · ")),
        ].join("")),
      };
    }
    return null;
  }

  const { data: profile } = await db.from("profiles").select("email, language").eq("id", n.profile_id ?? "").single();
  if (!profile?.email) throw new Error("recipient_missing");
  const lang: Lang = profile.language === "en" ? "en" : "fr";
  const t = OTHER_TEXT[lang];
  let title: string;
  let body: string;
  let extra = "";

  if (n.kind === "insurance_expiring") {
    [title, body] = t.insurance_expiring(formatDay(n.ref_date ?? "", lang));
  } else if (n.kind === "vaccination_expiring" || n.kind === "vaccination_reviewed") {
    const { data: dog } = await db.from("dogs").select("name").eq("id", n.dog_id ?? "").single();
    const vaccine = String(n.payload.vaccine ?? "");
    const name = dog?.name ?? "";
    if (n.kind === "vaccination_expiring") {
      [title, body] = t.vaccination_expiring(name, vaccine, formatDay(n.ref_date ?? "", lang));
    } else {
      [title, body] = n.payload.status === "validated" ? t.vaccination_validated(name, vaccine) : t.vaccination_rejected(name, vaccine);
      if (n.payload.note) extra = field(t.note, String(n.payload.note));
    }
  } else if (n.kind === "waitlist_slot_freed") {
    const { data: service } = await db.from("services").select("name, translations").eq("id", String(n.payload.service_id ?? "")).single();
    const localized = (service?.translations as Record<string, Record<string, string>> | null)?.[lang]?.name;
    [title, body] = t.waitlist_slot_freed(localized || service?.name || "FreePaws", formatDay(n.ref_date ?? "", lang));
  } else {
    return null;
  }

  return { to: profile.email, subject: title, html: layout(title, p(body) + extra + footer(lang)) };
}

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

  const db = makeDb(supabaseUrl, serviceKey);
  const { data: settings } = await db.from("settings").select("admin_email").single();
  const { data: claimed, error } = await db.rpc("claim_notifications", { p_limit: 25 });
  if (error) return new Response("error", { status: 500 });

  const send = async (email: Email) => {
    const response = await fetch(Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html }),
    });
    if (!response.ok) throw new Error(`resend_${response.status}`);
  };
  const markSent = (id: string, note: string | null = null) =>
    db.from("notifications").update({ sent_at: new Date().toISOString(), last_error: note }).eq("id", id);

  let sent = 0;
  for (const notification of (claimed ?? []) as NotificationRow[]) {
    try {
      if (notification.kind === "admin_emergency" || !notification.booking_id) {
        const email = await standaloneEmail(db, notification, settings?.admin_email ?? null);
        if (email) {
          await send(email);
          sent++;
        }
        await markSent(notification.id, email ? null : "skipped");
        continue;
      }

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
        await markSent(notification.id, "skipped");
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
            kind === "booking_cancelled" || service.cancel_notice_hours <= 0 ? "" : p(t.cancelPolicy(service.cancel_notice_hours)),
            documents,
            `<p style="font-size:13px;color:#6f6a60;margin:28px 0 0">${escapeHtml(t.footer)}</p>`,
          ].join(""),
        );
      }

      if (!to) throw new Error("recipient_missing");
      await send({ to, subject, html });
      await markSent(notification.id);
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
