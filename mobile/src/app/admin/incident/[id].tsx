import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  type ClientRow,
  type Incident,
  type IncidentKind,
  useClients,
  useIncidents,
  usePeopleAndDogs,
  useSaveIncident,
} from "@/api/admin-park";
import { INCIDENT_KINDS, incidentKindKey } from "@/components/admin/safety/incident-kinds";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { DateField } from "@/components/date-field";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { openStoredFile, pickFile, removeStoredFile, uploadFile } from "@/lib/files";
import { colors, radius, space } from "@/theme";
import { brusselsDateTime, formatTime, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

type Person = { id: string; name: string };
type Dog = { id: string; name: string };

export default function AdminIncidentRoute() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === "new";
  const incidents = useIncidents();
  const incident = isNew ? undefined : incidents.data?.find((item) => item.id === id);

  return (
    <AdminGuard>
      {isNew ? (
        <IncidentForm />
      ) : incidents.isLoading ? (
        <Screen underHeader>
          <LoadingView />
        </Screen>
      ) : incidents.isError ? (
        <Screen underHeader>
          <ErrorView error={incidents.error} onRetry={() => void incidents.refetch()} />
        </Screen>
      ) : incident ? (
        <IncidentForm key={incident.id} incident={incident} />
      ) : (
        <Screen underHeader>
          <EmptyView title={t("adminSafety.incidentNotFound")} />
        </Screen>
      )}
    </AdminGuard>
  );
}

const personName = (row: { full_name: string | null; email: string | null }, fallback: string) =>
  row.full_name?.trim() || row.email || fallback;

function IncidentForm({ incident }: { incident?: Incident }) {
  const { t } = useLanguage();
  const save = useSaveIncident();
  const now = new Date();

  const [incidentId, setIncidentId] = useState(incident?.id);
  // Pas de type présélectionné pour un nouvel incident : un incident saisi trop vite serait mal classé.
  const [kind, setKind] = useState<IncidentKind | null>(incident?.kind ?? null);
  const [day, setDay] = useState(toIsoDay(incident?.occurred_at ?? now));
  const [time, setTime] = useState(formatTime(incident?.occurred_at ?? now));
  const [description, setDescription] = useState(incident?.description ?? "");
  const [rule, setRule] = useState(incident?.rule_reference ?? "");
  const [personIds, setPersonIds] = useState<string[]>(incident?.person_ids ?? []);
  const [dogIds, setDogIds] = useState<string[]>(incident?.dog_ids ?? []);
  const [photos, setPhotos] = useState<string[]>(incident?.photo_paths ?? []);
  const [unsavedUploads, setUnsavedUploads] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  // Personnes choisies pendant cette saisie, avec leurs chiens (issus de la recherche).
  const [picked, setPicked] = useState<Record<string, { person: Person; dogs: Dog[] }>>({});
  const [error, setError] = useState<string | null>(null);

  const results = useClients(search);
  const recent = useClients("");
  const names = usePeopleAndDogs(incident?.person_ids ?? [], incident?.dog_ids ?? []);

  // Chiens connus par personne : clients chargés (recherche, récents) et personnes ajoutées.
  const knownClients = new Map<string, ClientRow>();
  for (const row of [...(recent.data ?? []), ...(results.data ?? [])]) knownClients.set(row.id, row);

  const people: Person[] = personIds.map((pid) => {
    const fromPick = picked[pid]?.person;
    if (fromPick) return fromPick;
    const known = knownClients.get(pid) ?? names.data?.people?.find((row) => row.id === pid);
    return { id: pid, name: known ? personName(known, t("adminSafety.unnamed")) : "…" };
  });

  const dogOptions = new Map<string, Dog>();
  for (const pid of personIds) {
    const dogs = picked[pid]?.dogs ?? knownClients.get(pid)?.dogs ?? [];
    for (const dog of dogs) dogOptions.set(dog.id, { id: dog.id, name: dog.name });
  }
  for (const dogId of dogIds) {
    if (!dogOptions.has(dogId)) {
      const named = names.data?.dogs?.find((dog) => dog.id === dogId);
      dogOptions.set(dogId, { id: dogId, name: named?.name ?? "…" });
    }
  }

  const addPerson = (row: ClientRow) => {
    if (personIds.includes(row.id)) return;
    setPicked({
      ...picked,
      [row.id]: {
        person: { id: row.id, name: personName(row, t("adminSafety.unnamed")) },
        dogs: (row.dogs ?? []).map((dog) => ({ id: dog.id, name: dog.name })),
      },
    });
    setPersonIds([...personIds, row.id]);
    setSearch("");
  };

  const removePerson = (pid: string) => {
    const theirDogs = new Set((picked[pid]?.dogs ?? knownClients.get(pid)?.dogs ?? []).map((dog) => dog.id));
    setPersonIds(personIds.filter((item) => item !== pid));
    setDogIds(dogIds.filter((dogId) => !theirDogs.has(dogId)));
  };

  const toggleDog = (dogId: string) =>
    setDogIds(dogIds.includes(dogId) ? dogIds.filter((item) => item !== dogId) : [...dogIds, dogId]);

  const addPhoto = async () => {
    setError(null);
    try {
      const file = await pickFile("image");
      if (!file) return;
      setUploading(true);
      const year = /^\d{4}/.test(day) ? day.slice(0, 4) : String(now.getFullYear());
      const path = await uploadFile("incidents", year, file);
      setPhotos((current) => [...current, path]);
      setUnsavedUploads((current) => [...current, path]);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (path: string) => {
    setPhotos(photos.filter((item) => item !== path));
    // Une photo téléversée mais jamais enregistrée dans l’incident est supprimée tout de suite.
    if (unsavedUploads.includes(path)) {
      setUnsavedUploads(unsavedUploads.filter((item) => item !== path));
      void removeStoredFile("incidents", path).catch(() => undefined);
    }
  };

  const openPhoto = (path: string) =>
    void openStoredFile("incidents", path).catch((err: unknown) => setError(toUserMessage(err)));

  const submit = () => {
    setError(null);
    if (!kind) return setError(t("adminSafety.kindRequired"));
    const occurred = day ? brusselsDateTime(day, time.trim()) : null;
    if (!occurred) return setError(t("adminSafety.dateError"));
    if (!description.trim()) return setError(t("adminSafety.descriptionRequired"));
    save.mutate(
      {
        id: incidentId,
        occurred_at: occurred.toISOString(),
        kind,
        description: description.trim(),
        rule_reference: rule.trim() || null,
        person_ids: personIds,
        dog_ids: dogIds,
        photo_paths: photos,
      },
      {
        onSuccess: (savedId) => {
          setUnsavedUploads([]);
          if (savedId && !incidentId) {
            setIncidentId(savedId);
            router.setParams({ id: savedId });
          }
          notify(t("adminSafety.incidentSaved"), "");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  const searchRows = search.trim() ? (results.data ?? []).filter((row) => !personIds.includes(row.id)).slice(0, 8) : [];

  return (
    <Screen
      underHeader
      footer={<Button label={t("common.save")} loading={save.isPending} disabled={uploading} onPress={submit} />}
    >
      <Stack.Screen options={{ title: incidentId ? t("adminSafety.editIncident") : t("adminSafety.newIncident") }} />
      <Card>
        <AppText variant="heading">{t("adminSafety.detailsTitle")}</AppText>
        <AppText variant="bodyStrong">{t("adminSafety.fieldKind")}</AppText>
        <View style={styles.chips}>
          {INCIDENT_KINDS.map((item) => (
            <Chip key={item} label={t(incidentKindKey(item))} selected={kind === item} onPress={() => setKind(item)} />
          ))}
        </View>
        <DateField label={t("adminSafety.fieldDate")} value={day} onChange={setDay} />
        <TextField
          label={t("adminSafety.fieldTime")}
          placeholder="HH:MM"
          value={time}
          onChangeText={setTime}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={t("adminSafety.fieldDescription")}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={4000}
        />
        <TextField
          label={t("adminSafety.fieldRule")}
          hint={t("adminSafety.fieldRuleHint")}
          value={rule}
          onChangeText={setRule}
          maxLength={200}
        />
      </Card>

      <Card>
        <AppText variant="heading" style={styles.cardTitle}>
          {t("adminSafety.peopleTitle")}
        </AppText>
        {people.length > 0 ? (
          <View style={styles.tags}>
            {people.map((person) => (
              <PersonTag
                key={person.id}
                name={person.name}
                removeLabel={t("adminSafety.remove", { name: person.name })}
                onRemove={() => removePerson(person.id)}
              />
            ))}
          </View>
        ) : null}
        <TextField
          label={t("adminSafety.searchPeople")}
          hint={t("adminSafety.searchHint")}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.trim() ? (
          results.isLoading ? (
            <LoadingView />
          ) : results.isError ? (
            <ErrorView error={results.error} onRetry={() => void results.refetch()} />
          ) : searchRows.length === 0 ? (
            <AppText variant="caption">{t("adminSafety.noPeopleFound")}</AppText>
          ) : (
            <View>
              {searchRows.map((row) => (
                <ListRow
                  key={row.id}
                  label={personName(row, t("adminSafety.unnamed"))}
                  detail={[row.email, row.phone].filter(Boolean).join(" · ")}
                  onPress={() => addPerson(row)}
                />
              ))}
            </View>
          )
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">{t("adminSafety.dogsTitle")}</AppText>
        {dogOptions.size === 0 ? (
          <AppText variant="caption">{t("adminSafety.dogsEmpty")}</AppText>
        ) : (
          <View style={styles.chips}>
            {[...dogOptions.values()].map((dog) => (
              <Chip
                key={dog.id}
                label={dog.name}
                selected={dogIds.includes(dog.id)}
                onPress={() => toggleDog(dog.id)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <AppText variant="heading">{t("adminSafety.photosTitle")}</AppText>
        {photos.map((path, index) => (
          <View key={path} style={styles.photoRow}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {t("adminSafety.photoLabel", { index: index + 1 })}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => openPhoto(path)}
              style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
            >
              <AppText variant="bodyStrong">{t("adminSafety.open")}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("adminSafety.removePhoto")} ${t("adminSafety.photoLabel", { index: index + 1 })}`}
              onPress={() => removePhoto(path)}
              style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
            >
              <AppText variant="bodyStrong" style={styles.danger}>
                {t("adminSafety.removePhoto")}
              </AppText>
            </Pressable>
          </View>
        ))}
        <Button
          label={t("adminSafety.addPhoto")}
          variant="secondary"
          loading={uploading}
          onPress={() => void addPhoto()}
        />
      </Card>

      {error ? (
        <AppText variant="bodyStrong" style={styles.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      {incidentId && people.length > 0 ? (
        <Card>
          <AppText variant="heading">{t("adminSafety.sanctionTitle")}</AppText>
          <AppText variant="body">{t("adminSafety.sanctionText")}</AppText>
          {/* La dernière ligne a déjà sa marge intérieure : pas de vide en plus sous la carte. */}
          <View style={styles.lastList}>
            {people.map((person, index) => (
              <ListRow
                key={person.id}
                label={person.name}
                last={index === people.length - 1}
                onPress={() =>
                  router.push({
                    pathname: "/admin/client/[id]",
                    params: { id: person.id, incident: incidentId },
                  })
                }
              />
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

/** Personne retenue : étiquette claire, nom aligné à gauche, bouton ✕ séparé pour la retirer. */
function PersonTag({ name, removeLabel, onRemove }: { name: string; removeLabel: string; onRemove: () => void }) {
  return (
    <View style={styles.tag}>
      <AppText variant="bodyStrong" style={styles.tagName}>
        {name}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        hitSlop={4}
        onPress={onRemove}
        style={({ pressed }) => [styles.tagRemove, pressed && styles.pressed]}
      >
        <AppText style={styles.tagRemoveText}>✕</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cardTitle: { marginBottom: space.xs },
  tags: { gap: space.xs },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
    paddingLeft: space.md,
    borderRadius: radius.md,
    // Fond olive clair sans bordure : une étiquette, pas un champ de saisie.
    backgroundColor: "rgba(108, 119, 70, 0.12)",
  },
  tagName: { flex: 1, paddingVertical: space.sm },
  tagRemove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tagRemoveText: { fontSize: 18, color: colors.inkSoft },
  lastList: { marginBottom: -space.md },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  flex: { flexGrow: 1, flexShrink: 1, minWidth: 100 },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.7 },
  danger: { color: colors.danger },
});
