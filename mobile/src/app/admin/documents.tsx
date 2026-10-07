import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useCreateDocument, useLegalDocuments, usePublishDocument } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { LANGUAGES, type Language, useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const KIND = /^[a-z0-9_]{2,40}$/;
/** Choix « Autre » : nouvel identifiant de type saisi à la main. */
const OTHER = "__other__";

export default function AdminDocumentsRoute() {
  return (
    <AdminGuard>
      <Documents />
    </AdminGuard>
  );
}

function Documents() {
  const { t, language: uiLanguage } = useLanguage();
  const documents = useLegalDocuments();
  const create = useCreateDocument();
  const publish = usePublishDocument();

  const [formOpen, setFormOpen] = useState(false);
  const [kindChoice, setKindChoice] = useState<string>("");
  const [customKind, setCustomKind] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Types existants, nommés par le titre de leur version la plus récente (langue de l’interface en priorité).
  const kinds = useMemo(() => {
    const byKind = new Map<string, { title: string; version: number; sameLanguage: boolean }>();
    for (const document of documents.data ?? []) {
      const sameLanguage = document.language === uiLanguage;
      const current = byKind.get(document.kind);
      if (
        !current ||
        (sameLanguage && !current.sameLanguage) ||
        (sameLanguage === current.sameLanguage && document.version > current.version)
      ) {
        byKind.set(document.kind, { title: document.title, version: document.version, sameLanguage });
      }
    }
    return [...byKind.entries()].map(([kind, info]) => ({ kind, label: info.title }));
  }, [documents.data, uiLanguage]);

  const kind = kindChoice === OTHER || kinds.length === 0 ? customKind : kindChoice;

  const submit = () => {
    setError(null);
    if (!KIND.test(kind)) return setError(kind ? t("admin.invalidKind") : t("v11Admin.docKindRequired"));
    if (!title.trim() || !body.trim()) return setError(t("admin.docRequired"));
    // Nouvelle version = dernière version de ce type et de cette langue + 1.
    const latest = Math.max(
      0,
      ...(documents.data ?? []).filter((d) => d.kind === kind && d.language === language).map((d) => d.version),
    );
    create.mutate(
      {
        kind,
        language,
        version: latest + 1,
        title: title.trim(),
        body: body.trim(),
        published_at: publishNow ? new Date().toISOString() : null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setPublishNow(false);
          setFormOpen(false);
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Screen underHeader refreshing={documents.isRefetching} onRefresh={() => void documents.refetch()}>
      {formOpen ? (
        <Card>
          <AppText variant="heading">{t("admin.newVersion")}</AppText>
          <AppText variant="bodyStrong">{t("v11Admin.docKind")}</AppText>
          {kinds.length > 0 ? (
            <View style={styles.chips}>
              {kinds.map((option) => (
                <Chip
                  key={option.kind}
                  label={option.label}
                  selected={kindChoice === option.kind}
                  onPress={() => setKindChoice(option.kind)}
                />
              ))}
              <Chip
                label={t("v11Admin.docKindOther")}
                selected={kindChoice === OTHER}
                onPress={() => setKindChoice(OTHER)}
              />
            </View>
          ) : null}
          {kindChoice === OTHER || kinds.length === 0 ? (
            <TextField
              label={t("v11Admin.docKindId")}
              hint={t("v11Admin.docKindIdHint")}
              value={customKind}
              onChangeText={(text) => setCustomKind(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoCapitalize="none"
              maxLength={40}
            />
          ) : null}
          <AppText variant="bodyStrong">{t("admin.docLanguage")}</AppText>
          <View style={styles.chips}>
            {LANGUAGES.map((option) => (
              <Chip
                key={option.code}
                label={option.label}
                selected={language === option.code}
                onPress={() => setLanguage(option.code)}
              />
            ))}
          </View>
          <TextField label={t("admin.docTitle")} value={title} onChangeText={setTitle} maxLength={200} />
          <TextField label={t("admin.docBody")} value={body} onChangeText={setBody} multiline />
          <Checkbox label={t("admin.publishNow")} checked={publishNow} onChange={setPublishNow} />
          {error ? (
            <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button label={t("admin.create")} loading={create.isPending} onPress={submit} />
          <Button
            label={t("v11Admin.cancel")}
            variant="ghost"
            onPress={() => {
              setError(null);
              setFormOpen(false);
            }}
          />
        </Card>
      ) : (
        <Button label={t("admin.newVersion")} onPress={() => setFormOpen(true)} style={styles.newButton} />
      )}

      <AppText variant="heading">{t("v11Admin.docListTitle")}</AppText>
      {documents.isLoading ? (
        <LoadingView />
      ) : documents.isError ? (
        <ErrorView error={documents.error} onRetry={() => void documents.refetch()} />
      ) : documents.data?.length === 0 ? (
        <AppText variant="body" style={styles.empty}>
          {t("admin.noDocuments")}
        </AppText>
      ) : (
        documents.data?.map((document) => {
          const open = openId === document.id;
          return (
            <Card key={document.id}>
              <Badge
                label={
                  document.published_at
                    ? t("admin.publishedOn", { date: formatDate(document.published_at) })
                    : t("admin.draft")
                }
                tone={document.published_at ? "success" : "neutral"}
              />
              <AppText variant="heading">{document.title}</AppText>
              <AppText variant="caption">
                {document.language.toUpperCase()} · {t("admin.versionLabel", { version: document.version })}
              </AppText>
              {open ? <AppText variant="body">{document.body}</AppText> : null}
              <View style={styles.actions}>
                <Button
                  label={open ? t("v11Admin.docHide") : t("v11Admin.docRead")}
                  variant="secondary"
                  onPress={() => setOpenId(open ? null : document.id)}
                  style={styles.action}
                />
                {!document.published_at ? (
                  <Button
                    label={t("admin.publish")}
                    loading={publish.isPending && publish.variables === document.id}
                    onPress={() => publish.mutate(document.id)}
                    style={styles.action}
                  />
                ) : null}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
  empty: { color: colors.inkSoft },
  newButton: { alignSelf: "flex-start" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: { flexGrow: 1, flexBasis: 140 },
});
