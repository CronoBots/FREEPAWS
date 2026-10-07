import { StyleSheet, View } from "react-native";

import { DOG_SIZES, type DogSize, type GroupDog } from "@/api/v11-client";
import { Checkbox } from "@/components/checkbox";
import { Segmented } from "@/components/segmented";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { space } from "@/theme";

/** Fiche courte d’un chien saisie sans compte : chiens d’autres foyers, chien d’un invité. */
export type DogDraft = { key: string; name: string; breed: string; size: DogSize | null; protocol: boolean };

let counter = 0;
export const newDogDraft = (dog?: GroupDog | null): DogDraft => ({
  key: `dog-${Date.now()}-${counter++}`,
  name: dog?.name ?? "",
  breed: dog?.breed ?? "",
  size: dog?.size ?? null,
  protocol: dog?.protocol ?? false,
});

export function toGroupDog(draft: DogDraft): GroupDog {
  return { name: draft.name.trim(), breed: draft.breed.trim() || null, size: draft.size, protocol: draft.protocol };
}

const SIZE_KEYS: Record<DogSize, TranslationKey> = {
  small: "v11Client.sizeSmall",
  medium: "v11Client.sizeMedium",
  large: "v11Client.sizeLarge",
  giant: "v11Client.sizeGiant",
};

export function sizeLabel(size: DogSize, t: (key: TranslationKey) => string) {
  return t(SIZE_KEYS[size]);
}

/** « Rex · Labrador · Grand · protocole » */
/** Nom · race · gabarit (le protocole s’affiche à part, en badge). */
export function describeDog(dog: GroupDog, t: (key: TranslationKey) => string) {
  return [dog.name, dog.breed, dog.size ? sizeLabel(dog.size, t) : null].filter(Boolean).join(" · ");
}

type Props = {
  value: DogDraft;
  onChange: (patch: Partial<DogDraft>) => void;
  /** Nom obligatoire (chiens du groupe) : message affiché après une tentative d’envoi. */
  nameError?: string;
};

export function DogFields({ value, onChange, nameError }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.fields}>
      <TextField
        label={t("v11Client.dogName")}
        value={value.name}
        onChangeText={(name) => onChange({ name })}
        autoComplete="off"
        maxLength={60}
        error={nameError}
      />
      <TextField
        label={t("v11Client.dogBreed")}
        value={value.breed}
        onChangeText={(breed) => onChange({ breed })}
        autoComplete="off"
        maxLength={80}
      />
      <AppText variant="bodyStrong">{t("v11Client.dogSize")}</AppText>
      {/* Grille 2 × 2 quand la place manque : jamais « Très grand » seul sur sa ligne. */}
      <Segmented
        accessibilityLabel={t("v11Client.dogSize")}
        options={DOG_SIZES.map((size) => ({ value: size, label: sizeLabel(size, t) }))}
        value={value.size}
        onChange={(size) => onChange({ size })}
      />
      <View>
        <Checkbox
          label={t("v11Client.dogProtocol")}
          checked={value.protocol}
          onChange={(protocol) => onChange({ protocol })}
        />
        <AppText variant="caption" style={styles.checkboxHint}>
          {t("v11Client.dogProtocolHint")}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.sm },
  // Aide alignée sous le libellé de la case (case de 26 px + écart).
  checkboxHint: { marginLeft: 26 + space.md, marginTop: -space.sm },
});
