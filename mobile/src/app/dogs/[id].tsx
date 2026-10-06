import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { type Dog, useDeleteDog, useDogs, useSaveDog } from "@/api/dogs";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { TextField } from "@/components/text-field";
import { confirm, notify } from "@/lib/confirm";
import { toUserMessage } from "@/utils/errors";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function DogRoute() {
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
        <EmptyView title="Chien introuvable" />
      </Screen>
    );
  }
  return <DogForm dog={dog} />;
}

function DogForm({ dog }: { dog?: Dog }) {
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
    if (!name.trim()) next.name = "Le nom est obligatoire.";
    if (
      birthDate &&
      (!DATE_PATTERN.test(birthDate) ||
        Number.isNaN(Date.parse(birthDate)) ||
        birthDate > new Date().toISOString().slice(0, 10))
    ) {
      next.birthDate = "Format attendu : AAAA-MM-JJ, dans le passé.";
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
        onError: (error) => notify("Enregistrement impossible", toUserMessage(error)),
      },
    );
  };

  const onDelete = async () => {
    if (!dog) return;
    const ok = await confirm({
      title: `Retirer ${dog.name} ?`,
      message: "Ses réservations passées restent dans votre historique.",
      confirmLabel: "Retirer",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(dog.id, {
      onSuccess: () => router.back(),
      onError: (error) => notify("Suppression impossible", toUserMessage(error)),
    });
  };

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: isNew ? "Nouveau chien" : (dog?.name ?? "Chien") }} />
      <TextField label="Nom" value={name} onChangeText={setName} maxLength={60} error={errors.name} />
      <TextField label="Race (facultatif)" value={breed} onChangeText={setBreed} maxLength={80} />
      <TextField
        label="Date de naissance (facultatif)"
        placeholder="AAAA-MM-JJ"
        value={birthDate}
        onChangeText={setBirthDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={errors.birthDate}
      />
      <TextField
        label="À savoir (facultatif)"
        hint="Réactivité, rappel, santé… tout ce qui aide à bien l’accueillir."
        value={notes}
        onChangeText={setNotes}
        maxLength={1000}
        multiline
      />
      <Button label="Enregistrer" loading={save.isPending} onPress={onSave} />
      {dog ? (
        <Button label="Retirer ce chien" variant="ghost" loading={remove.isPending} onPress={() => void onDelete()} />
      ) : null}
    </Screen>
  );
}
