import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useBooking } from "@/api/bookings";
import {
  type Answers,
  type AnswerValue,
  type Question,
  useQuestionnaireResponse,
  useQuestions,
  useSubmitQuestionnaire,
} from "@/api/v11-client";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDayLong, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Saisie en cours : les nombres restent du texte jusqu’à l’envoi. */
type Draft = Record<string, string | boolean | string[]>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(text: string) {
  if (!DATE_RE.test(text)) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function parseNumber(text: string) {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) ? value : null;
}

function toDraft(answers: Answers): Draft {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]): [string, Draft[string]] => [
      key,
      typeof value === "number" ? String(value) : value,
    ]),
  );
}

function isEmpty(value: Draft[string] | undefined) {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Erreur de saisie d’une question (null si la réponse convient). */
function fieldError(question: Question, value: Draft[string] | undefined): "required" | "number" | "date" | null {
  if (isEmpty(value)) return question.required ? "required" : null;
  if (question.kind === "number" && typeof value === "string" && parseNumber(value) === null) return "number";
  if (question.kind === "date" && typeof value === "string" && !validDate(value.trim())) return "date";
  return null;
}

function toAnswers(questions: Question[], draft: Draft): Answers {
  const answers: Answers = {};
  for (const question of questions) {
    const value = draft[question.id];
    if (isEmpty(value) || value === undefined) continue;
    if (question.kind === "number" && typeof value === "string") {
      const number = parseNumber(value);
      if (number !== null) answers[question.id] = number;
    } else {
      answers[question.id] = (typeof value === "string" ? value.trim() : value) as AnswerValue;
    }
  }
  return answers;
}

/** Questionnaire pré-visite d’une réservation (M1-05 / M1-11). */
export default function QuestionnaireRoute() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const questions = useQuestions(booking.data?.service.id);
  const response = useQuestionnaireResponse(id);
  const submit = useSubmitQuestionnaire();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = booking.isLoading || questions.isLoading || response.isLoading;
  const failed = booking.error ?? questions.error ?? response.error;
  const retry = () => void Promise.all([booking.refetch(), questions.refetch(), response.refetch()]);

  if (loading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (failed) {
    return (
      <Screen underHeader>
        <ErrorView error={failed} onRetry={retry} />
      </Screen>
    );
  }
  const data = booking.data;
  if (!data) {
    return (
      <Screen underHeader>
        <EmptyView title={t("booking.notFound")} />
      </Screen>
    );
  }
  const list = questions.data ?? [];
  if (list.length === 0) {
    return (
      <Screen underHeader>
        <EmptyView title={t("v11Client.qEmpty")} />
      </Screen>
    );
  }

  const editable = data.status === "confirmed" && data.start > new Date();
  const values: Draft = draft ?? toDraft(response.data?.answers ?? {});
  const set = (questionId: string, value: Draft[string]) => {
    setDraft({ ...values, [questionId]: value });
    setError(null);
  };

  const onSubmit = () => {
    setShowErrors(true);
    if (list.some((question) => fieldError(question, values[question.id]))) {
      return setError(t("v11Client.qMissing"));
    }
    setError(null);
    submit.mutate(
      { bookingId: data.id, answers: toAnswers(list, values) },
      {
        onSuccess: () => {
          notify(t("v11Client.qSaved"), t("v11Client.qSavedText"));
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: "/booking/[id]", params: { id: data.id } });
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  const footer = editable ? (
    <Button
      label={response.data ? t("v11Client.qUpdate") : t("v11Client.qSubmit")}
      loading={submit.isPending}
      onPress={onSubmit}
    />
  ) : undefined;

  return (
    <Screen underHeader heading={data.service.name} footer={footer}>
      <AppText variant="bodyStrong">
        {formatDayLong(data.start)} · {formatTime(data.start)}
      </AppText>
      <AppText variant="body">{editable ? t("v11Client.qIntro") : t("v11Client.qPast")}</AppText>
      {editable && list.some((question) => question.required) ? (
        <AppText variant="caption">{t("v11Client.qRequiredLegend")}</AppText>
      ) : null}

      {list.map((question) => (
        <Card key={question.id}>
          {editable ? (
            <QuestionField
              question={question}
              value={values[question.id]}
              onChange={(value) => set(question.id, value)}
              showErrors={showErrors}
            />
          ) : (
            <ReadOnlyAnswer question={question} value={values[question.id]} />
          )}
        </Card>
      ))}

      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  showErrors,
}: {
  question: Question;
  value: Draft[string] | undefined;
  onChange: (value: Draft[string]) => void;
  showErrors: boolean;
}) {
  const { t } = useLanguage();
  const label = question.required ? `${question.label} *` : question.label;
  const problem = showErrors ? fieldError(question, value) : null;
  const errorText =
    problem === "required"
      ? t("v11Client.qFieldRequired")
      : problem === "number"
        ? t("v11Client.qNumberInvalid")
        : problem === "date"
          ? t("v11Client.qDateInvalid")
          : undefined;
  const text = typeof value === "string" ? value : "";

  switch (question.kind) {
    case "text":
    case "long_text":
    case "number":
    case "date":
      return (
        <TextField
          label={label}
          hint={
            question.kind === "date"
              ? [question.help, t("v11Client.qDateHint")].filter(Boolean).join(" · ")
              : (question.help ?? undefined)
          }
          error={errorText}
          value={text}
          onChangeText={onChange}
          multiline={question.kind === "long_text"}
          maxLength={question.kind === "long_text" ? 2000 : question.kind === "text" ? 300 : 20}
          keyboardType={question.kind === "number" ? "decimal-pad" : "default"}
          placeholder={question.kind === "date" ? "2026-01-31" : undefined}
          autoCorrect={question.kind === "text" || question.kind === "long_text"}
        />
      );
    case "yes_no":
      return (
        <ChoiceBlock label={label} help={question.help} error={errorText}>
          <Chip label={t("v11Client.qYes")} selected={value === true} onPress={() => onChange(true)} />
          <Chip label={t("v11Client.qNo")} selected={value === false} onPress={() => onChange(false)} />
        </ChoiceBlock>
      );
    case "single_choice":
      return (
        <ChoiceBlock label={label} help={question.help} error={errorText}>
          {question.options.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(value === option.value ? "" : option.value)}
            />
          ))}
        </ChoiceBlock>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <ChoiceBlock
          label={label}
          help={[question.help, t("v11Client.qMultiHint")].filter(Boolean).join(" · ")}
          error={errorText}
        >
          {question.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <Chip
                key={option.value}
                label={checked ? `✓ ${option.label}` : option.label}
                accessibilityLabel={option.label}
                selected={checked}
                onPress={() =>
                  onChange(checked ? selected.filter((item) => item !== option.value) : [...selected, option.value])
                }
              />
            );
          })}
        </ChoiceBlock>
      );
    }
  }
}

function ChoiceBlock({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help: string | null;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.block}>
      <AppText variant="bodyStrong">{label}</AppText>
      {help ? <AppText variant="caption">{help}</AppText> : null}
      <View style={styles.chips}>{children}</View>
      {error ? (
        <AppText variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function ReadOnlyAnswer({ question, value }: { question: Question; value: Draft[string] | undefined }) {
  const { t } = useLanguage();
  const optionLabel = (raw: string) => question.options.find((option) => option.value === raw)?.label ?? raw;
  let answer: string;
  if (isEmpty(value) || value === undefined) answer = t("v11Client.qNoAnswer");
  else if (typeof value === "boolean") answer = value ? t("v11Client.qYes") : t("v11Client.qNo");
  else if (Array.isArray(value)) answer = value.map(optionLabel).join(", ");
  else answer = question.kind === "single_choice" ? optionLabel(value) : value;
  return (
    <View style={styles.block}>
      <AppText variant="bodyStrong">{question.label}</AppText>
      <AppText variant="body">{answer}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
