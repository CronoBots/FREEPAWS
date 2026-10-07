import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { AppText } from "@/components/text";
import { type DogDraft, DogFields, newDogDraft } from "@/components/v11/dog-fields";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";

/** Chaque ligne commencée doit porter un nom. */
export function groupDogsValid(drafts: DogDraft[]) {
  return drafts.every((dog) => dog.name.trim().length > 0);
}

type Props = {
  value: DogDraft[];
  onChange: (value: DogDraft[]) => void;
  certified: boolean;
  onCertifiedChange: (certified: boolean) => void;
  /** Plus de chien possible (plafond de la prestation atteint avec les chiens du compte). */
  canAdd: boolean;
  showErrors?: boolean;
  /** Affiché en bas de la carte (ex. total des chiens). */
  footer?: ReactNode;
};

/** Chiens d’autres foyers (M2-06) : listés par la personne qui réserve, avec certification. */
export function GroupDogsEditor({
  value,
  onChange,
  certified,
  onCertifiedChange,
  canAdd,
  showErrors = false,
  footer,
}: Props) {
  const { t } = useLanguage();
  const update = (key: string, patch: Partial<DogDraft>) =>
    onChange(value.map((dog) => (dog.key === key ? { ...dog, ...patch } : dog)));

  return (
    <Card>
      <AppText variant="heading">{t("v11Client.groupTitle")}</AppText>
      <AppText variant="caption">{t("v11Client.groupIntro")}</AppText>
      {value.length === 0 ? <AppText variant="caption">{t("v11Client.groupEmpty")}</AppText> : null}

      {value.map((dog, index) => (
        <View key={dog.key} style={styles.dog}>
          <View style={styles.header}>
            <AppText variant="bodyStrong" style={styles.title}>
              {t("v11Client.groupDogLabel", { n: index + 1 })}
            </AppText>
            <Button
              label={t("v11Client.groupRemove")}
              variant="dangerText"
              onPress={() => onChange(value.filter((item) => item.key !== dog.key))}
              style={styles.remove}
            />
          </View>
          <DogFields
            value={dog}
            onChange={(patch) => update(dog.key, patch)}
            nameError={showErrors && !dog.name.trim() ? t("v11Client.dogNameError") : undefined}
          />
        </View>
      ))}

      <Button
        label={t("v11Client.groupAdd")}
        variant="secondary"
        disabled={!canAdd}
        onPress={() => onChange([...value, newDogDraft()])}
      />

      {value.length > 0 ? (
        <View>
          <Checkbox label={t("v11Client.groupCertify")} checked={certified} onChange={onCertifiedChange} />
          {showErrors && !certified ? (
            <AppText variant="caption" style={styles.error} accessibilityLiveRegion="polite">
              {t("v11Client.groupCertifyRequired")}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  dog: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  header: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  title: { flex: 1, minWidth: 100 },
  remove: { minHeight: 40, paddingHorizontal: space.sm },
  error: { color: colors.danger },
});
