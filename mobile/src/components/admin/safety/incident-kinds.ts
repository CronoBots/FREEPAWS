import type { IncidentKind } from "@/api/admin-park";
import type { TranslationKey } from "@/i18n";
import { Constants } from "@/types/database";

/** Types d’incident dans l’ordre de l’énumération SQL. */
export const INCIDENT_KINDS: readonly IncidentKind[] = Constants.public.Enums.incident_kind;

export function incidentKindKey(kind: IncidentKind): TranslationKey {
  return `adminSafety.kind_${kind}`;
}
