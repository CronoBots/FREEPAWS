import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useAdminServices } from "@/api/admin";
import {
  type Question,
  questionOptions,
  questionTranslations,
  useDeleteQuestion,
  useQuestionnaireQuestions,
  useReorderQuestions,
  useSaveQuestion,
} from "@/api/v11-admin";
import { kindLabel, QuestionForm } from "@/components/admin/v11/question-form";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export default function AdminQuestionnaireRoute() {
  return (
    <AdminGuard>
      <QuestionnaireEditor />
    </AdminGuard>
  );
}

function QuestionnaireEditor() {
  const { t } = useLanguage();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const services = useAdminServices();
  const questions = useQuestionnaireQuestions(serviceId);
  const reorder = useReorderQuestions();
  // null : aucun formulaire ouvert ; "new" : nouvelle question ; sinon l’id de la question modifiée.
  const [editing, setEditing] = useState<string | null>(null);

  const service = services.data?.find((item) => item.id === serviceId);
  const list = questions.data ?? [];
  const nextPosition = list.reduce((max, question) => Math.max(max, question.position + 1), list.length);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ordered = [...list];
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    reorder.mutate(ordered, { onError: (err) => notify(t("v11Admin.saveFailed"), toUserMessage(err)) });
  };

  if (services.isLoading || questions.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (services.isError || questions.isError) {
    return (
      <Screen underHeader>
        <ErrorView
          error={services.error ?? questions.error}
          onRetry={() => {
            void services.refetch();
            void questions.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!service || !serviceId) {
    return (
      <Screen underHeader>
        <EmptyView title={t("notFound.service")} />
      </Screen>
    );
  }

  return (
    <Screen
      underHeader
      heading={service.name}
      refreshing={questions.isRefetching}
      onRefresh={() => void questions.refetch()}
    >
      <Card>
        <AppText variant="body">{t("v11Admin.intro")}</AppText>
        <AppText variant="caption">{t("v11Admin.introAnswers")}</AppText>
      </Card>

      {editing === "new" ? (
        <QuestionForm serviceId={serviceId} nextPosition={nextPosition} onDone={() => setEditing(null)} />
      ) : (
        <Button label={t("v11Admin.addQuestion")} onPress={() => setEditing("new")} style={styles.add} />
      )}

      {list.length === 0 && editing !== "new" ? (
        <EmptyView title={t("v11Admin.emptyTitle")} message={t("v11Admin.emptyText")} />
      ) : null}

      {list.map((question, index) =>
        editing === question.id ? (
          <QuestionForm
            key={question.id}
            serviceId={serviceId}
            question={question}
            nextPosition={nextPosition}
            onDone={() => setEditing(null)}
          />
        ) : (
          <QuestionCard
            key={question.id}
            question={question}
            number={index + 1}
            first={index === 0}
            last={index === list.length - 1}
            moving={reorder.isPending}
            onMove={(delta) => move(index, delta)}
            onEdit={() => setEditing(question.id)}
          />
        ),
      )}
    </Screen>
  );
}

function QuestionCard({
  question,
  number,
  first,
  last,
  moving,
  onMove,
  onEdit,
}: {
  question: Question;
  number: number;
  first: boolean;
  last: boolean;
  moving: boolean;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
}) {
  const { t } = useLanguage();
  const save = useSaveQuestion();
  const remove = useDeleteQuestion();
  const english = questionTranslations(question).en;
  const options = questionOptions(question);

  const toggle = (patch: { active?: boolean; required?: boolean }) =>
    save.mutate(
      { id: question.id, ...patch },
      { onError: (err) => notify(t("v11Admin.saveFailed"), toUserMessage(err)) },
    );

  const onDelete = async () => {
    const ok = await confirm({
      title: t("v11Admin.deleteTitle"),
      message: t("v11Admin.deleteText"),
      confirmLabel: t("v11Admin.delete"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(question.id, { onError: (err) => notify(t("v11Admin.deleteFailed"), toUserMessage(err)) });
  };

  return (
    <Card style={!question.active && styles.inactive}>
      <View style={styles.head}>
        <AppText variant="eyebrow" style={styles.flex}>
          {t("v11Admin.questionNumber", { number })}
        </AppText>
        <MoveButton
          icon="arrow-up"
          label={t("v11Admin.moveUpLabel", { number })}
          disabled={first || moving}
          onPress={() => onMove(-1)}
        />
        <MoveButton
          icon="arrow-down"
          label={t("v11Admin.moveDownLabel", { number })}
          disabled={last || moving}
          onPress={() => onMove(1)}
        />
      </View>
      <AppText variant="bodyStrong">{question.label}</AppText>
      {question.help ? <AppText variant="caption">{question.help}</AppText> : null}
      {english?.label ? <AppText variant="caption">EN · {english.label}</AppText> : null}
      <View style={styles.badges}>
        <Badge label={kindLabel(question.kind, t)} />
        {!question.active ? <Badge label={t("v11Admin.badgeInactive")} tone="danger" /> : null}
      </View>
      {options.length > 0 ? (
        <AppText variant="caption">{options.map((option) => option.label).join(" · ")}</AppText>
      ) : null}
      <View>
        <Checkbox label={t("v11Admin.active")} checked={question.active} onChange={(active) => toggle({ active })} />
        <Checkbox
          label={t("v11Admin.required")}
          checked={question.required}
          onChange={(required) => toggle({ required })}
        />
      </View>
      <View style={styles.actions}>
        <Button label={t("v11Admin.edit")} variant="secondary" style={styles.action} onPress={onEdit} />
        <Button
          label={t("v11Admin.delete")}
          variant="dangerText"
          style={styles.action}
          loading={remove.isPending}
          onPress={() => void onDelete()}
        />
      </View>
    </Card>
  );
}

function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "arrow-up" | "arrow-down";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.move, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inactive: { opacity: 0.75 },
  head: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: { minWidth: 130 },
  add: { alignSelf: "flex-start" },
  move: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
});
