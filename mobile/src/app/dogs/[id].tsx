import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type Dog, type DogInput, useDeleteDog, useDogs, useSaveDog } from "@/api/dogs";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { ChoiceRow, isValidIsoDay, todayIso, YesNoUnknown } from "@/components/fiche/form-parts";
import { VaccinationsSection } from "@/components/fiche/vaccinations-section";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { confirm, notify } from "@/lib/confirm";
import { space } from "@/theme";
import { toUserMessage } from "@/utils/errors";
import { useLanguage } from "@/i18n";

const CHIP_PATTERN = /^[0-9A-Za-z]{9,20}$/;
type Sex = "male" | "female";
type Size = "small" | "medium" | "large" | "giant";

export default function DogRoute() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dogs = useDogs();

  if (id === "new") return <DogForm />;
  if (dogs.isLoading)
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  if (dogs.isError) {
    return (
      <Screen underHeader>
        <ErrorView error={dogs.error} onRetry={() => void dogs.refetch()} />
      </Screen>
    );
  }
  const dog = dogs.data?.find((item) => item.id === id);
  if (!dog) {
    return (
      <Screen underHeader>
        <EmptyView title={t("dogs.notFound")} />
      </Screen>
    );
  }
  return <DogForm dog={dog} />;
}

function DogForm({ dog }: { dog?: Dog }) {
  const { t } = useLanguage();
  const isNew = !dog;
  const save = useSaveDog();
  const remove = useDeleteDog();

  const [name, setName] = useState(dog?.name ?? "");
  const [breed, setBreed] = useState(dog?.breed ?? "");
  const [birthDate, setBirthDate] = useState(dog?.birth_date ?? "");
  const [notes, setNotes] = useState(dog?.notes ?? "");
  const [sex, setSex] = useState<Sex | null>((dog?.sex as Sex | null) ?? null);
  const [size, setSize] = useState<Size | null>((dog?.size as Size | null) ?? null);
  const [chipNumber, setChipNumber] = useState(dog?.chip_number ?? "");
  const [dogidRegistered, setDogidRegistered] = useState(dog?.dogid_registered ?? false);
  const [sterilised, setSterilised] = useState<boolean | null>(dog?.sterilised ?? null);
  const [inHeat, setInHeat] = useState(dog?.in_heat ?? false);
  const [vetName, setVetName] = useState(dog?.vet_name ?? "");
  const [vetPhone, setVetPhone] = useState(dog?.vet_phone ?? "");
  const [biteHistory, setBiteHistory] = useState<boolean | null>(dog?.bite_history ?? null);
  const [reactivity, setReactivity] = useState(dog?.reactivity ?? "");
  const [specialNeeds, setSpecialNeeds] = useState(dog?.special_needs ?? "");
  const [errors, setErrors] = useState<{ name?: string; birthDate?: string; chip?: string }>({});

  const onSave = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("dogs.nameRequired");
    if (birthDate && (!isValidIsoDay(birthDate) || birthDate > todayIso())) next.birthDate = t("dogs.dateError");
    const chip = chipNumber.replace(/\s+/g, "");
    if (chip && !CHIP_PATTERN.test(chip)) next.chip = t("fiche.chipError");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const input: DogInput & { id?: string } = {
      id: dog?.id,
      name: name.trim(),
      breed: breed.trim() || null,
      birth_date: birthDate || null,
      notes: notes.trim() || null,
      sex,
      size,
      chip_number: chip || null,
      dogid_registered: dogidRegistered,
      sterilised,
      in_heat: sex === "female" ? inHeat : false,
      vet_name: vetName.trim() || null,
      vet_phone: vetPhone.trim() || null,
      bite_history: biteHistory,
      reactivity: reactivity.trim() || null,
      special_needs: specialNeeds.trim() || null,
    };
    save.mutate(input, {
      onSuccess: () => router.back(),
      onError: (error) => notify(t("profile.saveFailed"), toUserMessage(error)),
    });
  };

  const onDelete = async () => {
    if (!dog) return;
    const ok = await confirm({
      title: t("dogs.removeTitle", { name: dog.name }),
      message: t("dogs.removeMessage"),
      confirmLabel: t("dogs.removeConfirm"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(dog.id, {
      onSuccess: () => router.back(),
      onError: (error) => notify(t("dogs.removeFailed"), toUserMessage(error)),
    });
  };

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: isNew ? t("titles.newDog") : (dog?.name ?? t("titles.dog")) }} />

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionDog")}
        </AppText>
        <TextField label={t("dogs.name")} value={name} onChangeText={setName} maxLength={60} error={errors.name} />
        <TextField label={t("dogs.breed")} value={breed} onChangeText={setBreed} maxLength={80} />
        <TextField
          label={t("dogs.birthDate")}
          placeholder={t("dogs.datePlaceholder")}
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={errors.birthDate}
        />
        <ChoiceRow
          label={t("fiche.sex")}
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: t("fiche.male") },
            { value: "female", label: t("fiche.female") },
          ]}
        />
        <ChoiceRow
          label={t("fiche.size")}
          value={size}
          onChange={setSize}
          options={[
            { value: "small", label: t("fiche.sizeSmall") },
            { value: "medium", label: t("fiche.sizeMedium") },
            { value: "large", label: t("fiche.sizeLarge") },
            { value: "giant", label: t("fiche.sizeGiant") },
          ]}
        />
        <TextField
          label={t("fiche.chipNumber")}
          value={chipNumber}
          onChangeText={setChipNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={24}
          error={errors.chip}
        />
        <Checkbox label={t("fiche.dogid")} checked={dogidRegistered} onChange={setDogidRegistered} />
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionHealth")}
        </AppText>
        <YesNoUnknown label={t("fiche.sterilised")} value={sterilised} onChange={setSterilised} />
        {sex === "female" ? <Checkbox label={t("fiche.inHeat")} checked={inHeat} onChange={setInHeat} /> : null}
        <TextField
          label={t("dogs.notes")}
          hint={t("dogs.notesHint")}
          value={notes}
          onChangeText={setNotes}
          maxLength={1000}
          multiline
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionVet")}
        </AppText>
        <TextField label={t("fiche.vetName")} value={vetName} onChangeText={setVetName} maxLength={120} />
        <TextField
          label={t("fiche.vetPhone")}
          value={vetPhone}
          onChangeText={setVetPhone}
          keyboardType="phone-pad"
          maxLength={30}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionAdmission")}
        </AppText>
        <AppText variant="caption">{t("fiche.admissionIntro")}</AppText>
        <YesNoUnknown label={t("fiche.biteHistory")} value={biteHistory} onChange={setBiteHistory} />
        <TextField
          label={t("fiche.reactivity")}
          hint={t("fiche.reactivityHint")}
          value={reactivity}
          onChangeText={setReactivity}
          maxLength={1000}
          multiline
        />
        <TextField
          label={t("fiche.specialNeeds")}
          hint={t("fiche.specialNeedsHint")}
          value={specialNeeds}
          onChangeText={setSpecialNeeds}
          maxLength={1000}
          multiline
        />
      </View>

      <Button label={t("common.save")} loading={save.isPending} onPress={onSave} />

      {dog ? (
        <VaccinationsSection dogId={dog.id} />
      ) : (
        <Card>
          <AppText variant="body">{t("fiche.vaccinesAfterSave")}</AppText>
        </Card>
      )}

      {dog ? (
        <Button label={t("dogs.remove")} variant="ghost" loading={remove.isPending} onPress={() => void onDelete()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
});
