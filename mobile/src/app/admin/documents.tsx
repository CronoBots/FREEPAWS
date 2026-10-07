import { useState } from "react";
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

export default function AdminDocumentsRoute() {
  return (
    <AdminGuard>
      <Documents />
    </AdminGuard>
  );
}

function Documents() {
  const { t } = useLanguage();
  const documents = useLegalDocuments();
  const create = useCreateDocument();
  const publish = usePublishDocument();

  const [kind, setKind] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!KIND.test(kind)) return setError(t("admin.invalidKind"));
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
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Screen underHeader refreshing={documents.isRefetching} onRefresh={() => void documents.refetch()}>
      <Card>
        <AppText variant="heading">{t("admin.newVersion")}</AppText>
        <TextField
          label={t("admin.docKind")}
          value={kind}
          onChangeText={(text) => setKind(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          autoCapitalize="none"
          maxLength={40}
        />
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
      </Card>

      {documents.isLoading ? (
        <LoadingView />
      ) : documents.isError ? (
        <ErrorView error={documents.error} onRetry={() => void documents.refetch()} />
      ) : documents.data?.length === 0 ? (
        <AppText variant="body">{t("admin.noDocuments")}</AppText>
      ) : (
        documents.data?.map((document) => (
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
              {document.kind} · {document.language.toUpperCase()} ·{" "}
              {t("admin.versionLabel", { version: document.version })}
            </AppText>
            {!document.published_at ? (
              <Button
                label={t("admin.publish")}
                variant="secondary"
                loading={publish.isPending && publish.variables === document.id}
                onPress={() => publish.mutate(document.id)}
              />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
