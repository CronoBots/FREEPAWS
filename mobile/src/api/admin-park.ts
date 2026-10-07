import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { parkKeys } from "@/api/park-profile";
import { supabase } from "@/lib/supabase";
import { brusselsDateTime } from "@/utils/dates";
import { toRangeLiteral } from "@/utils/range";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database";

// Administration du parc : clients, vaccins à valider, sanctions, incidents, urgence, statistiques.

export const adminParkKeys = {
  clients: (search: string) => ["admin", "clients", search] as const,
  allClients: ["admin", "clients"] as const,
  client: (id: string) => ["admin", "client", id] as const,
  allClient: ["admin", "client"] as const,
  pendingVaccinations: ["admin", "vaccinations", "pending"] as const,
  vaccineTypes: ["admin", "vaccine-types"] as const,
  incidents: ["admin", "incidents"] as const,
  emergency: ["admin", "emergency"] as const,
  stats: (from: string, to: string) => ["admin", "stats", from, to] as const,
  parkSettings: ["admin", "park-settings"] as const,
};

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

function useInvalidating<T, R = void>(fn: (input: T) => Promise<R>, keys: readonly (readonly unknown[])[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

export type Profile = Tables<"profiles">;
export type Sanction = Tables<"sanctions">;
export type Incident = Tables<"incidents">;
export type AuditEntry = Tables<"audit_log">;
export type SanctionLevel = Database["public"]["Enums"]["sanction_level"];
export type IncidentKind = Database["public"]["Enums"]["incident_kind"];
export type UserRole = Database["public"]["Enums"]["user_role"];

const today = () => new Date().toISOString().slice(0, 10);

/** Une sanction est active si elle a commencé et n’est pas terminée. */
export function isActiveSanction(sanction: Pick<Sanction, "level" | "starts_at" | "ends_at">, now = new Date()) {
  return (
    sanction.level !== "warning" &&
    new Date(sanction.starts_at) <= now &&
    (sanction.ends_at == null || new Date(sanction.ends_at) > now)
  );
}

// --- Clients --------------------------------------------------------------------------------

/** Recherche par nom, email ou téléphone (vide = les plus récents). */
export function useClients(search: string) {
  const term = search.trim().replace(/[%,()]/g, " ");
  return useQuery({
    queryKey: adminParkKeys.clients(term),
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*, dogs ( id, name, protocol ), sanctions!sanctions_user_id_fkey ( level, starts_at, ends_at )")
        .order("created_at", { ascending: false })
        .limit(100);
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      return run(query);
    },
  });
}

export type ClientRow = NonNullable<ReturnType<typeof useClients>["data"]>[number];

/** Fiche complète d’un client : profil, chiens, vaccinations, sanctions, incidents, historique, réservations. */
export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: adminParkKeys.client(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const profile = await run(supabase.from("profiles").select("*").eq("id", id!).single());
      const dogs = await run(
        supabase
          .from("dogs")
          .select("*, vaccinations:dog_vaccinations ( *, vaccine:vaccine_types ( name ) )")
          .eq("owner_id", id!)
          .order("created_at"),
      );
      const dogIds = (dogs ?? []).map((dog) => dog.id);
      const [sanctions, incidents, history, bookings] = await Promise.all([
        run(supabase.from("sanctions").select("*").eq("user_id", id!).order("starts_at", { ascending: false })),
        run(
          supabase
            .from("incidents")
            .select("*")
            .or(`person_ids.cs.{${id}}${dogIds.length ? `,dog_ids.ov.{${dogIds.join(",")}}` : ""}`)
            .order("occurred_at", { ascending: false }),
        ),
        run(
          supabase
            .from("audit_log")
            .select("*")
            .in("row_id", [id!, ...dogIds])
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        run(
          supabase
            .from("bookings")
            .select("id, status, created_at, appointment:appointments ( period, service:services ( name ) )")
            .eq("client_id", id!)
            .order("created_at", { ascending: false })
            .limit(50),
        ),
      ]);
      return {
        profile,
        dogs: dogs ?? [],
        sanctions: sanctions ?? [],
        incidents: incidents ?? [],
        history: history ?? [],
        bookings: bookings ?? [],
      };
    },
  });
}

export type ClientDetails = NonNullable<ReturnType<typeof useClient>["data"]>;

export function useSetUserRole() {
  return useInvalidating(
    async ({ userId, role }: { userId: string; role: UserRole }) => {
      await run(supabase.rpc("set_user_role", { p_user_id: userId, p_role: role }));
    },
    [adminParkKeys.allClients, adminParkKeys.allClient],
  );
}

/** Drapeau « chien à protocole » et sa note. */
export function useSetDogProtocol() {
  return useInvalidating(
    async ({ dogId, protocol, note }: { dogId: string; protocol: boolean; note: string | null }) => {
      await run(supabase.from("dogs").update({ protocol, protocol_note: note }).eq("id", dogId).select("id"));
    },
    [adminParkKeys.allClients, adminParkKeys.allClient, adminParkKeys.emergency],
  );
}

export function useAddSanction() {
  return useInvalidating(
    async (input: Pick<TablesInsert<"sanctions">, "user_id" | "level" | "reason" | "ends_at" | "incident_id">) => {
      await run(supabase.from("sanctions").insert(input).select("id"));
    },
    [adminParkKeys.allClients, adminParkKeys.allClient],
  );
}

/** Lever une sanction : fin immédiate (l’historique est conservé). */
export function useEndSanction() {
  return useInvalidating(
    async (id: string) => {
      await run(supabase.from("sanctions").update({ ends_at: new Date().toISOString() }).eq("id", id).select("id"));
    },
    [adminParkKeys.allClients, adminParkKeys.allClient],
  );
}

// --- Vaccinations -----------------------------------------------------------------------------

export function usePendingVaccinations() {
  return useQuery({
    queryKey: adminParkKeys.pendingVaccinations,
    queryFn: () =>
      run(
        supabase
          .from("dog_vaccinations")
          .select(
            "*, vaccine:vaccine_types ( name ), dog:dogs ( id, name, breed, owner:profiles ( id, full_name, email ) )",
          )
          .eq("status", "pending")
          .order("created_at"),
      ),
  });
}

export function useReviewVaccination() {
  return useInvalidating(
    async ({ id, status, note }: { id: string; status: "validated" | "rejected"; note: string | null }) => {
      await run(supabase.from("dog_vaccinations").update({ status, review_note: note }).eq("id", id).select("id"));
    },
    [adminParkKeys.pendingVaccinations, adminParkKeys.allClient, parkKeys.allVaccinations],
  );
}

export function useAllVaccineTypes() {
  return useQuery({
    queryKey: adminParkKeys.vaccineTypes,
    queryFn: () => run(supabase.from("vaccine_types").select("*").order("sort_order").order("name")),
  });
}

export function useSaveVaccineType() {
  return useInvalidating(
    async ({ id, ...input }: TablesUpdate<"vaccine_types"> & { id?: string; name?: string }) => {
      await run(
        id
          ? supabase.from("vaccine_types").update(input).eq("id", id).select("id")
          : supabase
              .from("vaccine_types")
              .insert({ ...input, name: input.name ?? "" })
              .select("id"),
      );
    },
    [adminParkKeys.vaccineTypes, parkKeys.vaccineTypes],
  );
}

// --- Incidents --------------------------------------------------------------------------------

export function useIncidents() {
  return useQuery({
    queryKey: adminParkKeys.incidents,
    queryFn: () => run(supabase.from("incidents").select("*").order("occurred_at", { ascending: false }).limit(200)),
  });
}

export type IncidentInput = Pick<
  TablesInsert<"incidents">,
  "occurred_at" | "kind" | "description" | "rule_reference" | "booking_id" | "person_ids" | "dog_ids" | "photo_paths"
>;

export function useSaveIncident() {
  return useInvalidating(
    async ({ id, ...input }: IncidentInput & { id?: string }) => {
      const row = await run(
        id
          ? supabase.from("incidents").update(input).eq("id", id).select("id").single()
          : supabase.from("incidents").insert(input).select("id").single(),
      );
      return row?.id;
    },
    [adminParkKeys.incidents, adminParkKeys.allClient],
  );
}

/** Noms des personnes et chiens cités dans les incidents. */
export function usePeopleAndDogs(personIds: string[], dogIds: string[]) {
  return useQuery({
    queryKey: ["admin", "names", personIds.join(","), dogIds.join(",")],
    enabled: personIds.length + dogIds.length > 0,
    queryFn: async () => {
      const [people, dogs] = await Promise.all([
        personIds.length
          ? run(supabase.from("profiles").select("id, full_name, email").in("id", personIds))
          : Promise.resolve([]),
        dogIds.length ? run(supabase.from("dogs").select("id, name").in("id", dogIds)) : Promise.resolve([]),
      ]);
      return { people, dogs };
    },
  });
}

// --- Urgence ----------------------------------------------------------------------------------

export type EmergencyBooking = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  full_name: string;
  phone: string | null;
  email: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  adults_count: number | null;
  children_count: number | null;
  dogs: {
    id: string;
    name: string;
    breed: string | null;
    protocol: boolean;
    protocol_note: string | null;
    bite_history: boolean | null;
    reactivity: string | null;
  }[];
  guests: { full_name: string; phone: string | null; email: string | null }[];
  emergencies: { id: string; created_at: string; message: string | null }[];
};

/** Mode urgence : personnes sur place ou attendues, rafraîchi toutes les 30 secondes. */
export function useEmergencyOverview() {
  return useQuery({
    queryKey: adminParkKeys.emergency,
    refetchInterval: 30_000,
    queryFn: async () =>
      (await run(supabase.rpc("get_emergency_overview", { p_resource_slug: "park" }))) as unknown as EmergencyBooking[],
  });
}

export function useAcknowledgeEmergency() {
  return useInvalidating(
    async (id: string) => {
      await run(
        supabase.from("emergencies").update({ acknowledged_at: new Date().toISOString() }).eq("id", id).select("id"),
      );
    },
    [adminParkKeys.emergency],
  );
}

// --- Règles du parc et fiche secours ----------------------------------------------------------

export function useParkSettings() {
  return useQuery({
    queryKey: adminParkKeys.parkSettings,
    queryFn: () =>
      run(
        supabase
          .from("settings")
          .select(
            "min_dog_age_months, refuse_dogs_in_heat, refuse_ill_dogs, require_antiparasitic, expiry_alert_days, rescue_info",
          )
          .single(),
      ),
  });
}

export function useUpdateParkSettings() {
  return useInvalidating(
    async (
      values: Pick<
        TablesUpdate<"settings">,
        | "min_dog_age_months"
        | "refuse_dogs_in_heat"
        | "refuse_ill_dogs"
        | "require_antiparasitic"
        | "expiry_alert_days"
        | "rescue_info"
      >,
    ) => {
      await run(supabase.from("settings").update(values).eq("id", true).select("id"));
    },
    [adminParkKeys.parkSettings, parkKeys.rescueInfo],
  );
}

// --- Tableau de bord et exports ---------------------------------------------------------------

export type Stats = {
  bookings: number;
  cancellations: number;
  revenue_cents: number;
  new_clients: number;
  by_service: { name: string; count: number; revenue_cents: number }[];
  by_hour: Record<string, number>;
  by_weekday: Record<string, number>;
  fill_rate: { resource: string; booked_minutes: number; open_minutes: number; rate: number | null }[];
};

export function useStats(from: string, to: string) {
  return useQuery({
    queryKey: adminParkKeys.stats(from, to),
    queryFn: async () => (await run(supabase.rpc("admin_stats", { p_from: from, p_to: to }))) as unknown as Stats,
  });
}

/** Lignes pour l’export des clients (CSV). */
export async function fetchClientsForExport() {
  return run(
    supabase
      .from("profiles")
      .select(
        "full_name, email, phone, role, birth_date, emergency_contact_name, emergency_contact_phone, insurance_company, insurance_valid_until, created_at, dogs ( name )",
      )
      .order("full_name"),
  );
}

/** Lignes pour l’export des réservations d’une période (CSV). */
export async function fetchBookingsForExport(from: string, to: string) {
  return run(
    supabase
      .from("bookings")
      .select(
        `status, created_at, price_cents, discount_cents, adults_count, children_count, dogs_count, visit_address,
         appointment:appointments!inner ( period, service:services ( name ) ),
         client:profiles!bookings_client_id_fkey ( full_name, email, phone ),
         discount:discount_codes ( code )`,
      )
      .overlaps("appointment.period", toRangeLiteral(brusselsDateTime(from, "00:00")!, brusselsDateTime(to, "23:59")!))
      .order("created_at"),
  ).then((rows) => rows ?? []);
}

export { today };
