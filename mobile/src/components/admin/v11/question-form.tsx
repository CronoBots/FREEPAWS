import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  isChoiceKind,
  type Question,
  QUESTION_KINDS,
  type QuestionKind,
  type QuestionOption,
  questionOptions,
  questionTranslations,
  useSaveQuestion,
} from "@/api/v11-admin";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export const KIND_LABELS: Record<QuestionKind, TranslationKey> = {
  text: "v11Admin.kindText",
  long_text: "v11Admin.kindLongText",
  yes_no: "v11Admin.kindYesNo",
  single_choice: "v11Admin.kindSingleChoice",
  multi_choice: "v11Admin.kindMultiChoice",
  number: "v11Admin.kindNumber",
  date: "v11Admin.kindDate",
};

export function kindLabel(kind: string, t: (key: TranslationKey) => string) {
  return kind in KIND_LABELS ? t(KIND_LABELS[kind as QuestionKind]) : kind;
}

type DraftOption = { key: string; value?: string; label: string; labelEn: string };

let optionKey = 0;
const newOption = (option?: QuestionOption): DraftOption => ({
  key: `o${++optionKey}`,
  value: option?.value,
  label: option?.label ?? "",
  labelEn: option?.label_en ?? "",
});

/** Valeur technique d’un choix, générée à partir du libellé français (sans accents ni espaces). */
function slugify(label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "choix";
}

type Props = {
  serviceId: string;
  question?: Question;
  nextPosition: number;
  onDone: () => void;
};

export function QuestionForm({ serviceId, question, nextPosition, onDone }: Props) {
  const { t } = useLanguage();
  const save = useSaveQuestion();
  const english = questionTranslations(question ?? { translations: {} }).en ?? {};

  const [kind, setKind] = useState<QuestionKind>(
    QUESTION_KINDS.includes(question?.kind as QuestionKind) ? (question!.kind as QuestionKind) : "text",
  );
  const [label, setLabel] = useState(question?.label ?? "");
  const [help, setHelp] = useState(question?.help ?? "");
  const [labelEn, setLabelEn] = useState(english.label ?? "");
  const [helpEn, setHelpEn] = useState(english.help ?? "");
  const [required, setRequired] = useState(question?.required ?? false);
  const [active, setActive] = useState(question?.active ?? true);
  const [options, setOptions] = useState<DraftOption[]>(() => {
    const existing = question ? questionOptions(question) : [];
    return existing.length > 0 ? existing.map(newOption) : [newOption(), newOption()];
  });
  const [error, setError] = useState<string | null>(null);

  const choice = isChoiceKind(kind);
  const updateOption = (key: string, patch: Partial<DraftOption>) =>
    setOptions((list) => list.map((option) => (option.key === key ? { ...option, ...patch } : option)));

  const submit = () => {
    setError(null);
    if (!label.trim()) return setError(t("v11Admin.errorLabel"));
    let cleanOptions: QuestionOption[] = [];
    if (choice) {
      const filled = options.filter((option) => option.label.trim() || option.labelEn.trim());
      if (filled.length < 2 || filled.some((option) => !option.label.trim())) {
        return setError(t("v11Admin.errorOptions"));
      }
      const labels = filled.map((option) => option.label.trim().toLowerCase());
      if (new Set(labels).size !== labels.length) return setError(t("v11Admin.errorOptionsDuplicate"));
      // Les choix existants gardent leur valeur (les réponses déjà reçues restent lisibles).
      const used = new Set(filled.map((option) => option.value).filter(Boolean));
      cleanOptions = filled.map((option) => {
        let value = option.value;
        if (!value) {
          const base = slugify(option.label);
          value = base;
          for (let n = 2; used.has(value); n++) value = `${base}_${n}`;
          used.add(value);
        }
        const item: QuestionOption = { value, label: option.label.trim() };
        if (option.labelEn.trim()) item.label_en = option.labelEn.trim();
        return item;
      });
    }
    const en = Object.fromEntries(
      Object.entries({ label: labelEn.trim(), help: helpEn.trim() }).filter(([, value]) => value),
    );
    const otherTranslations = Object.fromEntries(
      Object.entries(questionTranslations(question ?? { translations: {} })).filter(([lang]) => lang !== "en"),
    );
    const values = {
      kind,
      label: label.trim(),
      help: help.trim() || null,
      options: cleanOptions,
      translations: Object.keys(en).length ? { ...otherTranslations, en } : otherTranslations,
      required,
      active,
    };
    save.mutate(
      question ? { id: question.id, ...values } : { ...values, service_id: serviceId, position: nextPosition },
      { onSuccess: onDone, onError: (err) => setError(toUserMessage(err)) },
    );
  };

  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        {question ? t("v11Admin.editQuestion") : t("v11Admin.newQuestion")}
      </AppText>

      <View style={styles.block}>
        <AppText variant="bodyStrong">{t("v11Admin.fieldKind")}</AppText>
        <View style={styles.chips}>
          {QUESTION_KINDS.map((item) => (
            <Chip key={item} label={t(KIND_LABELS[item])} selected={kind === item} onPress={() => setKind(item)} />
          ))}
        </View>
      </View>

      <TextField label={t("v11Admin.fieldLabel")} value={label} onChangeText={setLabel} maxLength={300} multiline />
      <TextField
        label={t("v11Admin.fieldHelp")}
        hint={t("v11Admin.fieldHelpHint")}
        value={help}
        onChangeText={setHelp}
        maxLength={600}
        multiline
      />

      {choice ? (
        <View style={styles.block}>
          <AppText variant="bodyStrong">{t("v11Admin.options")}</AppText>
          <AppText variant="caption">{t("v11Admin.optionsHint")}</AppText>
          {options.map((option, index) => (
            <View key={option.key} style={styles.option}>
              <View style={styles.optionFields}>
                <TextField
                  label={t("v11Admin.optionLabel", { number: index + 1 })}
                  value={option.label}
                  onChangeText={(value) => updateOption(option.key, { label: value })}
                  maxLength={120}
                />
                <TextField
                  label={t("v11Admin.optionLabelEn", { number: index + 1 })}
                  value={option.labelEn}
                  onChangeText={(value) => updateOption(option.key, { labelEn: value })}
                  maxLength={120}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("v11Admin.removeOption", { number: index + 1 })}
                hitSlop={8}
                onPress={() => setOptions((list) => list.filter((item) => item.key !== option.key))}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <Button
            label={t("v11Admin.addOption")}
            variant="secondary"
            disabled={options.length >= 30}
            onPress={() => setOptions((list) => [...list, newOption()])}
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <AppText variant="bodyStrong">{t("v11Admin.sectionEnglish")}</AppText>
        <AppText variant="caption">{t("v11Admin.englishHint")}</AppText>
      </View>
      <TextField
        label={t("v11Admin.fieldLabelEn")}
        value={labelEn}
        onChangeText={setLabelEn}
        maxLength={300}
        multiline
      />
      <TextField label={t("v11Admin.fieldHelpEn")} value={helpEn} onChangeText={setHelpEn} maxLength={600} multiline />

      <Checkbox label={t("v11Admin.required")} checked={required} onChange={setRequired} />
      <Checkbox label={t("v11Admin.active")} checked={active} onChange={setActive} />

      <QuestionPreview
        kind={kind}
        label={label}
        help={help}
        required={required}
        options={options.filter((option) => option.label.trim()).map((option) => option.label.trim())}
      />

      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label={t("v11Admin.cancel")} variant="ghost" style={styles.action} onPress={onDone} />
        <Button label={t("v11Admin.save")} loading={save.isPending} style={styles.action} onPress={submit} />
      </View>
    </Card>
  );
}

/** Aperçu court du rendu côté client (non interactif). */
export function QuestionPreview({
  kind,
  label,
  help,
  required,
  options,
}: {
  kind: string;
  label: string;
  help: string;
  required: boolean;
  options: string[];
}) {
  const { t } = useLanguage();
  const field = (text: string, tall = false) => (
    <View style={[styles.fakeInput, tall && styles.fakeInputTall]}>
      <AppText variant="caption">{text}</AppText>
    </View>
  );
  return (
    <View style={styles.preview} accessibilityLabel={t("v11Admin.preview")}>
      <AppText variant="eyebrow">{t("v11Admin.preview")}</AppText>
      <AppText variant="bodyStrong">
        {label.trim() || "…"}
        {required ? ` ${t("v11Admin.requiredMark")}` : ""}
      </AppText>
      {help.trim() ? <AppText variant="caption">{help.trim()}</AppText> : null}
      {kind === "text" ? field(t("v11Admin.previewText")) : null}
      {kind === "long_text" ? field(t("v11Admin.previewLongText"), true) : null}
      {kind === "number" ? field(t("v11Admin.previewNumber")) : null}
      {kind === "date" ? field(t("v11Admin.previewDate")) : null}
      {kind === "yes_no" || isChoiceKind(kind) ? (
        <View style={styles.chips}>
          {(kind === "yes_no" ? [t("v11Admin.yes"), t("v11Admin.no")] : options).map((option, index) => (
            <Chip key={`${option}-${index}`} label={option} selected={false} disabled onPress={() => undefined} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  block: { gap: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  optionFields: { flex: 1, minWidth: 0, gap: space.sm },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  pressed: { opacity: 0.6 },
  preview: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  fakeInput: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  fakeInputTall: { minHeight: 88, justifyContent: "flex-start", paddingTop: space.sm },
  error: { color: colors.danger },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: { flexGrow: 1, flexBasis: 120 },
});
