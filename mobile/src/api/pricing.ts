import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

// Tarification paramétrable, jours fériés et vacances, agendas importés, jours complets, live invité.

export const pricingKeys = {
  rules: (serviceId: string) => ["admin", "pricing", serviceId] as const,
  allRules: ["admin", "pricing"] as const,
  calendarDays: ["admin", "calendar-days"] as const,
  feeds: ["admin", "calendar-feeds"] as const,
  quote: (serviceId: string, startsAt: string, dogs: number, guests: number, code: string) =>
    ["quote", serviceId, startsAt, dogs, guests, code] as const,
  fullDays: (serviceId: string, from: string, to: string) => ["full-days", serviceId, from, to] as const,
};

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

function useInvalidating<T>(fn: (input: T) => Promise<void>, keys: readonly (readonly unknown[])[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

// --- Règles de prix (admin) -------------------------------------------------------------------

export type PricingRule = Tables<"pricing_rules">;
export type PricingRuleInput = Omit<TablesInsert<"pricing_rules">, "id" | "created_at">;

export function usePricingRules(serviceId: string | undefined) {
  return useQuery({
    queryKey: pricingKeys.rules(serviceId ?? ""),
    enabled: Boolean(serviceId),
    queryFn: async () =>
      (await run(
        supabase.from("pricing_rules").select("*").eq("service_id", serviceId!).order("kind").order("sort_order"),
      )) ?? [],
  });
}

export function useSavePricingRule() {
  return useInvalidating(
    async ({ id, ...input }: PricingRuleInput & { id?: string }) => {
      await run(
        id
          ? supabase.from("pricing_rules").update(input).eq("id", id).select("id")
          : supabase.from("pricing_rules").insert(input).select("id"),
      );
    },
    [pricingKeys.allRules, ["quote"]],
  );
}

export function useDeletePricingRule() {
  return useInvalidating(
    async (id: string) => {
      await run(supabase.from("pricing_rules").delete().eq("id", id).select("id"));
    },
    [pricingKeys.allRules, ["quote"]],
  );
}

// --- Jours fériés et vacances (admin) ---------------------------------------------------------

export type CalendarDay = Tables<"calendar_days">;

export function useCalendarDays() {
  return useQuery({
    queryKey: pricingKeys.calendarDays,
    queryFn: async () =>
      (await run(
        supabase
          .from("calendar_days")
          .select("*")
          .gte("day", new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10))
          .order("day"),
      )) ?? [],
  });
}

/** Ajoute une période (chaque jour entre deux dates incluses). */
export function useAddCalendarDays() {
  return useInvalidating(
    async ({ from, to, kind, label }: { from: string; to: string; kind: CalendarDay["kind"]; label: string }) => {
      const days: TablesInsert<"calendar_days">[] = [];
      for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push({ day: d.toISOString().slice(0, 10), kind, label });
        if (days.length > 366) throw new Error("invalid_range");
      }
      await run(supabase.from("calendar_days").upsert(days).select("day"));
    },
    [pricingKeys.calendarDays, ["quote"]],
  );
}

export function useDeleteCalendarDays() {
  return useInvalidating(
    async (days: string[]) => {
      await run(supabase.from("calendar_days").delete().in("day", days).select("day"));
    },
    [pricingKeys.calendarDays, ["quote"]],
  );
}

// --- Agendas personnels importés (admin) ------------------------------------------------------

export type CalendarFeed = Tables<"calendar_feeds">;

export function useCalendarFeeds() {
  return useQuery({
    queryKey: pricingKeys.feeds,
    queryFn: async () => (await run(supabase.from("calendar_feeds").select("*").order("created_at"))) ?? [],
  });
}

export function useSaveCalendarFeed() {
  return useInvalidating(
    async ({
      id,
      ...input
    }: Pick<TablesUpdate<"calendar_feeds">, "label" | "url" | "active" | "resource_id"> & {
      id?: string;
    }) => {
      await run(
        id
          ? supabase.from("calendar_feeds").update(input).eq("id", id).select("id")
          : supabase
              .from("calendar_feeds")
              .insert({ url: input.url ?? "", resource_id: input.resource_id ?? "", label: input.label ?? "" })
              .select("id"),
      );
    },
    [pricingKeys.feeds],
  );
}

export function useDeleteCalendarFeed() {
  return useInvalidating(
    async (id: string) => {
      await run(supabase.from("calendar_feeds").delete().eq("id", id).select("id"));
    },
    [pricingKeys.feeds, queryKeys.allSlots],
  );
}

// --- Côté client : aperçu du prix, jours complets, live invité --------------------------------

export type Quote = { price_cents: number | null; discount_cents: number | null; labels: string[] };

/** Prix calculé par le serveur pour un créneau (null si le prix n’est pas affiché). */
export function useQuote(input: {
  serviceId: string;
  startsAt: string | null;
  dogs: number;
  guests: number;
  discountCode?: string;
}) {
  const code = input.discountCode?.trim() ?? "";
  return useQuery({
    queryKey: pricingKeys.quote(input.serviceId, input.startsAt ?? "", input.dogs, input.guests, code),
    enabled: Boolean(input.startsAt),
    queryFn: async (): Promise<Quote> => {
      const rows = await run(
        supabase.rpc("quote_price", {
          p_service_id: input.serviceId,
          p_starts_at: input.startsAt!,
          p_dogs_count: input.dogs,
          p_guests_count: input.guests,
          p_discount_code: code || undefined,
        }),
      );
      const row = rows?.[0];
      return {
        price_cents: row?.price_cents ?? null,
        discount_cents: row?.discount_cents ?? null,
        labels: row?.labels ?? [],
      };
    },
  });
}

/** Jours où tous les créneaux sont pris (AAAA-MM-JJ) : on peut s’y inscrire en liste d’attente. */
export function useFullDays(serviceId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: pricingKeys.fullDays(serviceId, from, to),
    enabled,
    queryFn: async () =>
      ((await run(supabase.rpc("get_full_days", { p_service_id: serviceId, p_from: from, p_to: to }))) ??
        []) as string[],
  });
}

export type GuestLive = {
  mode: "private" | "not_started" | "denied";
  startsAt?: string | null;
  endsAt?: string | null;
  guestName?: string | null;
  expiresAt?: string | null;
  streams: { id: string; name: string; url: string }[];
};

/** Direct d’un invité (lien personnel, sans compte), rafraîchi avant expiration. */
export function useGuestLive(token: string | undefined) {
  return useQuery({
    queryKey: ["guest-live", token],
    enabled: Boolean(token),
    refetchInterval: 60_000,
    queryFn: async (): Promise<GuestLive> => {
      const { data, error } = await supabase.functions.invoke("live-stream", { body: { guest_token: token } });
      if (error) throw error;
      return data as GuestLive;
    },
  });
}
