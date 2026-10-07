import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useResources, useSettings } from "@/api/admin";
import { type CalendarFeed, useCalendarFeeds, useDeleteCalendarFeed, useSaveCalendarFeed } from "@/api/pricing";
import { maskUrl } from "@/components/admin/pricing/format";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { ResourceSwitch, useDefaultResource } from "@/components/resource-switch";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { env } from "@/lib/env";
import { colors, space } from "@/theme";
import { formatDate, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const URL_PATTERN = /^(https|webcal):\/\/[^\s/?#]+\S*$/i;

export default function AdminCalendarSyncRoute() {
  return (
    <AdminGuard>
      <CalendarSync />
    </AdminGuard>
  );
}

function CalendarSync() {
  const { t, tp } = useLanguage();
  const feeds = useCalendarFeeds();
  const resources = useResources();
  const settings = useSettings();
  const save = useSaveCalendarFeed();
  const remove = useDeleteCalendarFeed();

  const [picked, setPicked] = useState<string | null>(null);
  const resourceId = useDefaultResource(picked);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  // Même lien d’abonnement que sur l’accueil de l’administration.
  const feedUrl = settings.data
    ? `${env.supabaseUrl}/functions/v1/calendar-feed?token=${settings.data.calendar_token}`
    : null;

  const resourceName = (id: string) => {
    const slug = resources.data?.find((resource) => resource.id === id)?.slug;
    return slug === "park" ? t("admin.resourcePark") : slug ? t("admin.resourceCoach") : "";
  };

  const submit = () => {
    setError(null);
    const address = url.trim();
    if (!resourceId) return setError(t("pricing.errorResource"));
    if (!URL_PATTERN.test(address) || address.length > 1000) return setError(t("pricing.errorUrl"));
    save.mutate(
      { resource_id: resourceId, label: label.trim(), url: address },
      {
        onSuccess: () => {
          setLabel("");
          setUrl("");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  const toggle = (feed: CalendarFeed, active: boolean) =>
    save.mutate({ id: feed.id, active }, { onError: (err) => notify(t("pricing.feedActive"), toUserMessage(err)) });

  const askDelete = async (feed: CalendarFeed) => {
    const ok = await confirm({
      title: t("pricing.deleteFeedTitle"),
      message: t("pricing.deleteFeedMessage"),
      confirmLabel: t("pricing.deleteFeed"),
      destructive: true,
    });
    if (ok) {
      remove.mutate(feed.id, { onError: (err) => notify(t("pricing.deleteFeedTitle"), toUserMessage(err)) });
    }
  };

  return (
    <Screen underHeader refreshing={feeds.isRefetching} onRefresh={() => void feeds.refetch()}>
      <Card>
        <AppText variant="heading">{t("pricing.syncOutTitle")}</AppText>
        <AppText variant="body">{t("pricing.syncOutText")}</AppText>
        {settings.isLoading ? (
          <LoadingView />
        ) : settings.isError ? (
          <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />
        ) : feedUrl ? (
          <>
            {/* Une ligne tronquée : le bouton Copier donne l’adresse complète. */}
            <AppText variant="caption" numberOfLines={1} ellipsizeMode="tail" selectable>
              {feedUrl}
            </AppText>
            <Button
              label={t("admin.copyLink")}
              variant="secondary"
              onPress={() => void Clipboard.setStringAsync(feedUrl).then(() => notify(t("admin.linkCopied"), ""))}
            />
          </>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">{t("pricing.syncInTitle")}</AppText>
        <AppText variant="body">{t("pricing.syncInText")}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: howOpen }}
          onPress={() => setHowOpen((open) => !open)}
          style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
        >
          <AppText variant="bodyStrong" style={styles.disclosureText}>
            {t("pricing.syncHowTitle")}
          </AppText>
          <Ionicons name={howOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.olive} />
        </Pressable>
        {howOpen ? (
          <View style={styles.how}>
            <AppText variant="body">{t("pricing.syncHowGoogle")}</AppText>
            <AppText variant="body">{t("pricing.syncHowOther")}</AppText>
            <AppText variant="body">{t("pricing.syncFrequency")}</AppText>
          </View>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">{t("pricing.addFeed")}</AppText>
        <AppText variant="bodyStrong">{t("pricing.fieldResource")}</AppText>
        <ResourceSwitch value={resourceId} onChange={setPicked} />
        <TextField
          label={t("pricing.fieldFeedLabel")}
          placeholder={t("pricing.feedLabelPlaceholder")}
          value={label}
          onChangeText={setLabel}
          maxLength={120}
        />
        <TextField
          label={t("pricing.fieldUrl")}
          hint={t("pricing.fieldUrlHint")}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={1000}
        />
        <AppText variant="caption">{t("pricing.syncSecret")}</AppText>
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("pricing.add")} loading={save.isPending && !save.variables?.id} onPress={submit} />
      </Card>

      <AppText variant="heading">{t("pricing.feedsTitle")}</AppText>
      {feeds.isLoading ? (
        <LoadingView />
      ) : feeds.isError ? (
        <ErrorView error={feeds.error} onRetry={() => void feeds.refetch()} />
      ) : (feeds.data ?? []).length === 0 ? (
        <AppText variant="body">{t("pricing.noFeeds")}</AppText>
      ) : (
        feeds.data?.map((feed) => (
          <Card key={feed.id}>
            <View style={styles.badges}>
              <Badge label={resourceName(feed.resource_id)} />
              {feed.last_error ? <Badge label={t("pricing.syncError")} tone="danger" /> : null}
            </View>
            <AppText variant="bodyStrong">{feed.label || t("pricing.feedUntitled")}</AppText>
            <AppText variant="caption">{maskUrl(feed.url)}</AppText>
            <AppText variant="body">
              {feed.last_synced_at
                ? t("pricing.lastSync", {
                    date: `${formatDate(feed.last_synced_at)} ${formatTime(feed.last_synced_at)}`,
                  })
                : t("pricing.neverSynced")}
            </AppText>
            {feed.event_count != null ? (
              <AppText variant="caption">{tp("pricing.eventCount", feed.event_count)}</AppText>
            ) : null}
            {feed.last_error ? (
              <AppText variant="caption" style={styles.error}>
                {feed.last_error}
              </AppText>
            ) : null}
            <Checkbox
              label={t("pricing.feedActive")}
              checked={feed.active}
              onChange={(active) => toggle(feed, active)}
            />
            <View style={styles.actions}>
              <Button
                label={t("pricing.deleteFeed")}
                variant="dangerText"
                loading={remove.isPending && remove.variables === feed.id}
                onPress={() => void askDelete(feed)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // Chevron collé au libellé, comme sur les autres écrans.
  disclosure: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: space.xs, minHeight: 44 },
  disclosureText: { flexShrink: 1, color: colors.olive },
  pressed: { opacity: 0.6 },
  how: { gap: space.sm },
  actions: { flexDirection: "row" },
  error: { color: colors.danger },
});
