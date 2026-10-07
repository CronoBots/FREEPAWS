import type { EmergencyBookingV11 } from "@/api/v11-admin";
import { dogText, healthWarningText } from "@/components/admin/v11/format";
import { t, tp } from "@/i18n";
import { formatDate, formatTime } from "@/utils/dates";

/** M9-03 : fiche secours en texte brut (personnes sur place ou attendues, contacts, chiens, consignes). */
export function buildRescueSheet(
  bookings: EmergencyBookingV11[],
  rescueInfo: string | null | undefined,
  now = new Date(),
) {
  const lines: string[] = [];
  const none = t("adminSafety.sheetNone");
  const contact = (name: string | null | undefined, phone: string | null | undefined) =>
    [name?.trim(), phone?.trim()].filter(Boolean).join(" · ") || none;

  lines.push(t("adminSafety.sheetTitle"));
  lines.push(t("adminSafety.sheetGenerated", { date: formatDate(now), time: formatTime(now) }));
  lines.push("");

  if (rescueInfo?.trim()) {
    lines.push(`== ${t("adminSafety.sheetRescue")} ==`, rescueInfo.trim(), "");
  }

  lines.push(`== ${t("adminSafety.sheetOnSite")} ==`);
  if (bookings.length === 0) lines.push(t("adminSafety.sheetNobody"));

  for (const booking of bookings) {
    lines.push("");
    lines.push(`${formatTime(booking.starts_at)} – ${formatTime(booking.ends_at)} · ${booking.service_name}`);
    lines.push(t("adminSafety.sheetResponsible", { name: booking.full_name }));
    lines.push(t("adminSafety.sheetPhone", { phone: booking.phone?.trim() || none }));
    lines.push(
      t("adminSafety.sheetEmergencyContact", {
        contact: contact(booking.emergency_contact_name, booking.emergency_contact_phone),
      }),
    );
    const party = [
      booking.adults_count != null ? tp("adminSafety.adults", booking.adults_count) : null,
      booking.children_count ? tp("adminSafety.children", booking.children_count) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (party) lines.push(t("adminSafety.sheetParty", { party }));

    if (booking.dogs.length > 0) {
      lines.push(t("adminSafety.sheetDogs"));
      for (const dog of booking.dogs) {
        const flags = [
          dog.protocol ? t("adminSafety.sheetProtocol") : null,
          dog.bite_history ? t("adminSafety.sheetBite") : null,
        ].filter(Boolean);
        lines.push(
          `- ${[dog.name, dog.breed].filter(Boolean).join(" · ")}${flags.length ? ` (${flags.join(", ")})` : ""}`,
        );
        if (dog.protocol && dog.protocol_note?.trim()) lines.push(`  ${dog.protocol_note.trim()}`);
        if (dog.reactivity?.trim()) lines.push(`  ${t("adminSafety.reactivity", { value: dog.reactivity.trim() })}`);
      }
    }

    const groupDogs = booking.group_dogs ?? [];
    if (groupDogs.length > 0) {
      lines.push(t("adminSafety.sheetGroupDogs"));
      for (const dog of groupDogs) {
        lines.push(`- ${dogText(dog)}${dog.protocol ? ` (${t("adminSafety.sheetProtocol")})` : ""}`);
      }
    }

    const warnings = booking.health_warnings ?? [];
    if (warnings.length > 0) {
      lines.push(t("adminSafety.sheetHealth"));
      for (const warning of warnings) lines.push(`- ${healthWarningText(warning)}`);
    }

    if (booking.guests.length > 0) {
      lines.push(t("adminSafety.sheetGuests"));
      for (const guest of booking.guests) {
        lines.push(`- ${guest.full_name} · ${guest.phone?.trim() || none}`);
        lines.push(
          `  ${t("adminSafety.sheetEmergencyContact", {
            contact: contact(guest.emergency_contact_name, guest.emergency_contact_phone),
          })}`,
        );
        if (guest.dog?.name) {
          lines.push(
            `  ${t("adminSafety.guestDog", { dog: dogText(guest.dog) })}${guest.dog.protocol ? ` (${t("adminSafety.sheetProtocol")})` : ""}`,
          );
        }
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
