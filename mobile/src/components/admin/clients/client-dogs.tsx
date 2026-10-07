import { router } from "expo-router";
import { Children, type PropsWithChildren, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { type ClientDetails, useSetDogProtocol } from "@/api/admin-park";
import {
  BadgeRow,
  dayDate,
  ErrorText,
  InfoLine,
  keepTogether,
  openProof,
  Section,
  todayIso,
  vaccineName,
} from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

type Dog = ClientDetails["dogs"][number];
type Vaccination = Dog["vaccinations"][number];

const SIZES: Record<string, TranslationKey> = {
  small: "adminClients.sizeSmall",
  medium: "adminClients.sizeMedium",
  large: "adminClients.sizeLarge",
  giant: "adminClients.sizeGiant",
};

/**
 * Une carte par chien, au premier niveau de la fiche (pas de carte « Chiens » qui les englobe) : on
 * évite trois niveaux de cartes imbriquées.
 */
export function ClientDogs({ dogs }: { dogs: Dog[] }) {
  const { t } = useLanguage();
  if (dogs.length === 0) {
    return (
      <Section title={t("adminClients.dogsTitle")}>
        <AppText variant="body">{t("adminClients.noDogs")}</AppText>
      </Section>
    );
  }
  return (
    <>
      {dogs.map((dog) => (
        <DogCard key={dog.id} dog={dog} />
      ))}
    </>
  );
}

function DogCard({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const yesNo = (value: boolean | null | undefined) =>
    value == null ? t("adminClients.unknown") : value ? t("adminClients.yes") : t("adminClients.no");
  const sex = dog.sex === "male" ? t("adminClients.male") : dog.sex === "female" ? t("adminClients.female") : null;
  const size = dog.size && SIZES[dog.size] ? t(SIZES[dog.size]!) : null;
  const vet = [dog.vet_name, dog.vet_phone ? keepTogether(dog.vet_phone) : null].filter(Boolean).join(" · ");

  return (
    <Section title={dog.name}>
      {/* Badges « En chaleur » / « Malade » seuls (pas de ligne qui les répète) ; le protocole a sa rubrique. */}
      {dog.in_heat || dog.currently_ill ? (
        <BadgeRow>
          {dog.in_heat ? <Badge label={t("adminClients.inHeat")} tone="danger" /> : null}
          {dog.currently_ill ? <Badge label={t("adminClients.ill")} tone="danger" /> : null}
        </BadgeRow>
      ) : null}
      <Grid>
        <InfoLine label={t("adminClients.breed")} value={dog.breed} />
        <InfoLine
          label={t("adminClients.dogBirth")}
          value={dog.birth_date ? formatDate(dayDate(dog.birth_date)) : null}
        />
        <InfoLine label={t("adminClients.sex")} value={sex} />
        <InfoLine label={t("adminClients.size")} value={size} />
        <InfoLine label={t("adminClients.chip")} value={dog.chip_number} />
        <InfoLine
          label={t("adminClients.dogid")}
          value={dog.dogid_registered ? t("adminClients.dogidYes") : t("adminClients.dogidNo")}
        />
        <InfoLine label={t("adminClients.sterilised")} value={yesNo(dog.sterilised)} />
        <InfoLine label={t("adminClients.vet")} value={vet} />
        <InfoLine
          label={t("adminClients.antiparasiticUntil")}
          value={dog.antiparasitic_until ? formatDate(dayDate(dog.antiparasitic_until)) : null}
        />
      </Grid>
      {dog.notes ? <InfoLine label={t("adminClients.notes")} value={dog.notes} /> : null}

      <AppText variant="bodyStrong" style={styles.subTitle}>
        {t("adminClients.admission")}
      </AppText>
      <Grid>
        <InfoLine label={t("adminClients.biteHistory")} value={yesNo(dog.bite_history)} />
        <InfoLine label={t("adminClients.reactivity")} value={dog.reactivity} />
        <InfoLine label={t("adminClients.specialNeeds")} value={dog.special_needs} />
      </Grid>

      <Protocol dog={dog} />

      <AppText variant="bodyStrong" style={styles.subTitle}>
        {t("adminClients.vaccinations")}
      </AppText>
      {dog.vaccinations.length === 0 ? (
        <AppText variant="caption">{t("adminClients.noVaccinations")}</AppText>
      ) : (
        dog.vaccinations.map((item) => <VaccinationLine key={item.id} item={item} />)
      )}
    </Section>
  );
}

/** Libellés et valeurs en deux colonnes dès que la largeur le permet. */
function Grid({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  return (
    <View style={[styles.grid, wide && styles.gridWide]}>
      {Children.map(children, (child) => (child ? <View style={wide && styles.cell}>{child}</View> : null))}
    </View>
  );
}

/** Protocole en lecture ; « Modifier le protocole » ouvre l’édition (case + note) sur place. */
function Protocol({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const save = useSetDogProtocol();
  const [editing, setEditing] = useState(false);
  const [protocol, setProtocol] = useState(dog.protocol);
  const [note, setNote] = useState(dog.protocol_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const dirty = protocol !== dog.protocol || note.trim() !== (dog.protocol_note ?? "").trim();

  const open = () => {
    setProtocol(dog.protocol);
    setNote(dog.protocol_note ?? "");
    setError(null);
    setEditing(true);
  };

  const submit = () => {
    setError(null);
    save.mutate(
      { dogId: dog.id, protocol, note: note.trim() || null },
      {
        onSuccess: () => {
          setEditing(false);
          notify(t("adminClients.protocolSaved"), "");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  if (!editing) {
    return (
      <View style={styles.protocol}>
        <AppText variant="bodyStrong">{t("adminClients.protocolTitle")}</AppText>
        {dog.protocol ? (
          <>
            <BadgeRow>
              <Badge label={t("adminClients.badgeProtocol")} tone="warning" />
            </BadgeRow>
            <AppText variant="body" style={styles.strong}>
              {dog.protocol_note?.trim() || t("adminClients.protocolNoNote")}
            </AppText>
          </>
        ) : (
          <AppText variant="body">{t("adminClients.protocolOff")}</AppText>
        )}
        <Button label={t("adminClients.protocolEdit")} variant="secondary" onPress={open} style={styles.editButton} />
      </View>
    );
  }

  return (
    <View style={styles.protocol}>
      <AppText variant="bodyStrong">{t("adminClients.protocolTitle")}</AppText>
      <Checkbox label={t("adminClients.protocol")} checked={protocol} onChange={setProtocol} />
      <TextField
        label={t("adminClients.protocolNote")}
        hint={t("adminClients.protocolHint")}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.editActions}>
        <Button
          label={t("common.cancel")}
          variant="secondary"
          onPress={() => setEditing(false)}
          style={styles.editAction}
        />
        <Button
          label={t("common.save")}
          disabled={!dirty}
          loading={save.isPending}
          onPress={submit}
          style={styles.editAction}
        />
      </View>
    </View>
  );
}

function VaccinationLine({ item }: { item: Vaccination }) {
  const { t } = useLanguage();
  const expired = item.status === "validated" && item.valid_until < todayIso();
  const badge = expired
    ? { label: t("adminClients.statusExpired"), tone: "danger" as const }
    : item.status === "validated"
      ? { label: t("adminClients.statusValidated"), tone: "success" as const }
      : item.status === "rejected"
        ? { label: t("adminClients.statusRejected"), tone: "danger" as const }
        : { label: t("adminClients.statusPending"), tone: "warning" as const };
  return (
    <View style={styles.vaccine}>
      <AppText variant="body" style={styles.strong}>
        {vaccineName(item.vaccine)}
      </AppText>
      <Badge label={badge.label} tone={badge.tone} />
      <AppText variant="caption">
        {t("adminClients.vaccineDates", {
          date: formatDate(dayDate(item.vaccinated_on)),
          until: formatDate(dayDate(item.valid_until)),
        })}
      </AppText>
      {item.review_note ? (
        <AppText variant="caption">{t("adminClients.reviewNote", { note: item.review_note })}</AppText>
      ) : null}
      <View style={styles.vaccineActions}>
        {item.proof_path ? (
          <Button label={t("adminClients.proof")} variant="secondary" onPress={() => openProof(item.proof_path!)} />
        ) : null}
        {item.status === "pending" ? (
          <Button label={t("adminClients.toReview")} onPress={() => router.push("/admin/vaccinations")} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subTitle: { marginTop: space.xs },
  grid: { gap: space.sm },
  gridWide: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm, columnGap: space.md },
  cell: { width: "47%" },
  // Rubrique séparée par un filet, sans panneau de couleur supplémentaire.
  protocol: {
    gap: space.sm,
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  editButton: { alignSelf: "flex-start" },
  editActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  editAction: { flexGrow: 1, flexBasis: 140 },
  vaccine: { gap: space.xs, paddingVertical: space.xs },
  vaccineActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  strong: { color: colors.ink },
});
