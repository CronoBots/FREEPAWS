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
import { colors, radius, space } from "@/theme";
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

export function ClientDogs({ dogs }: { dogs: Dog[] }) {
  const { t } = useLanguage();
  return (
    <Section title={t("adminClients.dogsTitle")}>
      {dogs.length === 0 ? <AppText variant="body">{t("adminClients.noDogs")}</AppText> : null}
      {dogs.map((dog) => (
        <DogBlock key={dog.id} dog={dog} />
      ))}
    </Section>
  );
}

function DogBlock({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const yesNo = (value: boolean | null | undefined) =>
    value == null ? t("adminClients.unknown") : value ? t("adminClients.yes") : t("adminClients.no");
  const sex = dog.sex === "male" ? t("adminClients.male") : dog.sex === "female" ? t("adminClients.female") : null;
  const size = dog.size && SIZES[dog.size] ? t(SIZES[dog.size]!) : null;
  const vet = [dog.vet_name, dog.vet_phone ? keepTogether(dog.vet_phone) : null].filter(Boolean).join(" · ");

  return (
    <View style={styles.dog}>
      <AppText variant="heading">{dog.name}</AppText>
      <BadgeRow>
        {dog.protocol ? <Badge label={t("adminClients.badgeProtocol")} tone="danger" /> : null}
        {dog.in_heat ? <Badge label={t("adminClients.inHeat")} tone="danger" /> : null}
      </BadgeRow>
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
        <InfoLine label={t("adminClients.inHeat")} value={yesNo(dog.in_heat)} />
        <InfoLine label={t("adminClients.vet")} value={vet} />
      </Grid>
      {dog.notes ? <InfoLine label={t("adminClients.notes")} value={dog.notes} /> : null}

      <AppText variant="bodyStrong">{t("adminClients.admission")}</AppText>
      <Grid>
        <InfoLine label={t("adminClients.biteHistory")} value={yesNo(dog.bite_history)} />
        <InfoLine label={t("adminClients.reactivity")} value={dog.reactivity} />
        <InfoLine label={t("adminClients.specialNeeds")} value={dog.special_needs} />
      </Grid>

      <ProtocolForm dog={dog} />

      <AppText variant="bodyStrong">{t("adminClients.vaccinations")}</AppText>
      {dog.vaccinations.length === 0 ? (
        <AppText variant="caption">{t("adminClients.noVaccinations")}</AppText>
      ) : (
        dog.vaccinations.map((item) => <VaccinationLine key={item.id} item={item} />)
      )}
    </View>
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

function ProtocolForm({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const save = useSetDogProtocol();
  const [protocol, setProtocol] = useState(dog.protocol);
  const [note, setNote] = useState(dog.protocol_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const dirty = protocol !== dog.protocol || note.trim() !== (dog.protocol_note ?? "").trim();

  const submit = () => {
    setError(null);
    save.mutate(
      { dogId: dog.id, protocol, note: note.trim() || null },
      {
        onSuccess: () => notify(t("adminClients.protocolSaved"), ""),
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <View style={styles.protocol}>
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
      <Button
        label={t("common.save")}
        variant="secondary"
        disabled={!dirty}
        loading={save.isPending}
        onPress={submit}
      />
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
  dog: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.cream,
  },
  grid: { gap: space.sm },
  gridWide: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm, columnGap: space.md },
  cell: { width: "47%" },
  protocol: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  vaccine: { gap: space.xs, paddingVertical: space.xs },
  vaccineActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  strong: { color: colors.ink },
});
