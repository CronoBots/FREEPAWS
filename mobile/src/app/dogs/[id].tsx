import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { type Dog, useDeleteDog, useDogs, useSaveDog } from "@/api/dogs";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { TextField } from "@/components/text-field";
import { confirm, notify } from "@/lib/confirm";
import { toUserMessage } from "@/utils/errors";
import { useLanguage } from "@/i18n";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  const [errors, setErrors] = useState<{ name?: string; birthDate?: string }>({});

  const onSave = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("dogs.nameRequired");
    if (
      birthDate &&
      (!DATE_PATTERN.test(birthDate) ||
        Number.isNaN(Date.parse(birthDate)) ||
        birthDate > new Date().toISOString().slice(0, 10))
    ) {
      next.birthDate = t("dogs.dateError");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        id: dog?.id,
        name: name.trim(),
        breed: breed.trim() || null,
        birth_date: birthDate || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => router.back(),
        onError: (error) => notify(t("profile.saveFailed"), toUserMessage(error)),
      },
    );
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
      <TextField
        label={t("dogs.notes")}
        hint={t("dogs.notesHint")}
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Button label={t("common.save")} loading={save.isPending} onPress={onSave} />
      {dog ? (
        <Button label={t("dogs.remove")} variant="ghost" loading={remove.isPending} onPress={() => void onDelete()} />
      ) : null}
    </Screen>
  );
}
