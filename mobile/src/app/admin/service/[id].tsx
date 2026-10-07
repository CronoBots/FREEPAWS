import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAdminServices, useLegalDocuments, useUpdateService } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { Screen } from "@/components/screen";
import { EmptyView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import type { Tables } from "@/types/database";
import { toUserMessage } from "@/utils/errors";

type Service = Tables<"services">;
type EnglishContent = { name?: string; summary?: string; description?: string; location?: string };

export default function AdminServiceRoute() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const services = useAdminServices();
  const service = services.data?.find((item) => item.id === id);
  return (
    <AdminGuard>
      {services.isLoading ? (
        <Screen underHeader>
          <LoadingView />
        </Screen>
      ) : service ? (
        <ServiceForm service={service} />
      ) : (
        <Screen underHeader>
          <EmptyView title={t("notFound.service")} />
        </Screen>
      )}
    </AdminGuard>
  );
}

/** Champ numérique : texte libre, converti et vérifié à l’enregistrement. */
const NUMBER_FIELDS = [
  ["duration_minutes", "admin.fieldDuration", 15, 480, true],
  ["slot_step_minutes", "admin.fieldStep", 5, 240, false],
  ["buffer_minutes", "admin.fieldBuffer", 0, 240, false],
  ["min_notice_hours", "admin.fieldMinNotice", 0, 8760, false],
  ["max_advance_days", "admin.fieldMaxAdvance", 1, 365, false],
  ["cancel_notice_hours", "admin.fieldCancelNotice", 0, 8760, false],
  ["max_dogs", "admin.fieldMaxDogs", 1, 20, true],
  ["default_capacity", "admin.fieldCapacity", 1, 50, false],
] as const satisfies readonly (readonly [keyof Service, TranslationKey, number, number, boolean])[];

type NumberField = (typeof NUMBER_FIELDS)[number][0];

function ServiceForm({ service }: { service: Service }) {
  const { t } = useLanguage();
  const update = useUpdateService();
  const documents = useLegalDocuments();
  const english = ((service.translations ?? {}) as Record<string, EnglishContent>).en ?? {};

  const [name, setName] = useState(service.name);
  const [summary, setSummary] = useState(service.summary);
  const [description, setDescription] = useState(service.description);
  const [location, setLocation] = useState(service.location);
  const [en, setEn] = useState<EnglishContent>(english);
  const [price, setPrice] = useState(service.price_cents == null ? "" : String(service.price_cents / 100));
  const [priceVisible, setPriceVisible] = useState(service.price_visible);
  const [numbers, setNumbers] = useState<Record<NumberField, string>>(
    () =>
      Object.fromEntries(
        NUMBER_FIELDS.map(([key]) => [key, service[key] == null ? "" : String(service[key])]),
      ) as Record<NumberField, string>,
  );
  const [requiresAddress, setRequiresAddress] = useState(service.requires_address);
  const [requiresParkProfile, setRequiresParkProfile] = useState(service.requires_park_profile);
  const [maxPeople, setMaxPeople] = useState(service.max_people == null ? "" : String(service.max_people));
  const [bookingEnabled, setBookingEnabled] = useState(service.booking_enabled);
  const [active, setActive] = useState(service.active);
  const [kinds, setKinds] = useState<string[]>(service.required_document_kinds);
  const [error, setError] = useState<string | null>(null);

  const availableKinds = [...new Set((documents.data ?? []).map((document) => document.kind))];

  const save = () => {
    setError(null);
    const parsed: Partial<Record<NumberField, number | null>> = {};
    for (const [key, label, min, max, nullable] of NUMBER_FIELDS) {
      const raw = numbers[key].trim();
      if (raw === "" && nullable) {
        parsed[key] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isInteger(value) || value < min || value > max) {
        return setError(t("admin.invalidNumber", { field: t(label) }));
      }
      parsed[key] = value;
    }
    const priceText = price.trim().replace(",", ".");
    const priceValue = priceText === "" ? null : Math.round(Number(priceText) * 100);
    if (priceValue != null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      return setError(t("admin.invalidNumber", { field: t("admin.fieldPrice") }));
    }
    if (bookingEnabled && parsed.duration_minutes == null) {
      return setError(t("admin.invalidNumber", { field: t("admin.fieldDuration") }));
    }
    const maxPeopleValue = maxPeople.trim() === "" ? null : Number(maxPeople);
    if (maxPeopleValue != null && (!Number.isInteger(maxPeopleValue) || maxPeopleValue < 1 || maxPeopleValue > 100)) {
      return setError(t("admin.invalidNumber", { field: t("adminSafety.maxPeople") }));
    }
    const cleanEn = Object.fromEntries(Object.entries(en).filter(([, value]) => value?.trim()));

    update.mutate(
      {
        id: service.id,
        name: name.trim(),
        summary: summary.trim(),
        description: description.trim(),
        location: location.trim(),
        translations: { ...(service.translations as object), en: cleanEn },
        price_cents: priceValue,
        price_visible: priceVisible,
        duration_minutes: parsed.duration_minutes ?? null,
        slot_step_minutes: parsed.slot_step_minutes ?? service.slot_step_minutes,
        buffer_minutes: parsed.buffer_minutes ?? service.buffer_minutes,
        min_notice_hours: parsed.min_notice_hours ?? service.min_notice_hours,
        max_advance_days: parsed.max_advance_days ?? service.max_advance_days,
        cancel_notice_hours: parsed.cancel_notice_hours ?? service.cancel_notice_hours,
        max_dogs: parsed.max_dogs ?? null,
        default_capacity: parsed.default_capacity ?? service.default_capacity,
        requires_address: requiresAddress,
        requires_park_profile: requiresParkProfile,
        max_people: maxPeopleValue,
        booking_enabled: bookingEnabled,
        active,
        required_document_kinds: kinds,
      },
      {
        onSuccess: () => notify(t("admin.saved"), ""),
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen
        underHeader
        heading={service.name}
        footer={<Button label={t("common.save")} loading={update.isPending} onPress={save} />}
      >
        <Card>
          <AppText variant="heading">{t("admin.sectionContent")}</AppText>
          <TextField label={t("admin.fieldName")} value={name} onChangeText={setName} maxLength={120} />
          <TextField label={t("admin.fieldSummary")} value={summary} onChangeText={setSummary} multiline />
          <TextField label={t("admin.fieldDescription")} value={description} onChangeText={setDescription} multiline />
          <TextField label={t("admin.fieldLocation")} value={location} onChangeText={setLocation} />
        </Card>

        <Card>
          <AppText variant="heading">{t("admin.sectionEnglish")}</AppText>
          <TextField
            label={t("admin.fieldName")}
            value={en.name ?? ""}
            onChangeText={(v) => setEn({ ...en, name: v })}
          />
          <TextField
            label={t("admin.fieldSummary")}
            value={en.summary ?? ""}
            onChangeText={(v) => setEn({ ...en, summary: v })}
            multiline
          />
          <TextField
            label={t("admin.fieldDescription")}
            value={en.description ?? ""}
            onChangeText={(v) => setEn({ ...en, description: v })}
            multiline
          />
          <TextField
            label={t("admin.fieldLocation")}
            value={en.location ?? ""}
            onChangeText={(v) => setEn({ ...en, location: v })}
          />
        </Card>

        <Card>
          <AppText variant="heading">{t("admin.sectionRules")}</AppText>
          <Checkbox label={t("admin.fieldActive")} checked={active} onChange={setActive} />
          <Checkbox label={t("admin.fieldBookingEnabled")} checked={bookingEnabled} onChange={setBookingEnabled} />
          <TextField
            label={t("admin.fieldPrice")}
            hint={t("admin.fieldPriceHint")}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <Checkbox label={t("admin.fieldPriceVisible")} checked={priceVisible} onChange={setPriceVisible} />
          {NUMBER_FIELDS.map(([key, label]) =>
            key === "default_capacity" && service.mode !== "event" ? null : (
              <TextField
                key={key}
                label={t(label)}
                value={numbers[key]}
                onChangeText={(value) => setNumbers({ ...numbers, [key]: value.replace(/\D/g, "") })}
                keyboardType="number-pad"
                maxLength={4}
              />
            ),
          )}
          <Checkbox label={t("admin.fieldRequiresAddress")} checked={requiresAddress} onChange={setRequiresAddress} />
          <Checkbox
            label={t("adminSafety.requiresParkProfile")}
            checked={requiresParkProfile}
            onChange={setRequiresParkProfile}
          />
          <TextField
            label={t("adminSafety.maxPeople")}
            hint={t("adminSafety.maxPeopleHint")}
            value={maxPeople}
            onChangeText={(value) => setMaxPeople(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={3}
          />
          {availableKinds.length > 0 ? (
            <View style={styles.kinds}>
              <AppText variant="bodyStrong">{t("admin.fieldDocuments")}</AppText>
              <View style={styles.chips}>
                {availableKinds.map((kind) => (
                  <Chip
                    key={kind}
                    label={kind}
                    selected={kinds.includes(kind)}
                    onPress={() =>
                      setKinds(kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind])
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  kinds: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
