import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAdminServices } from "@/api/admin";
import { localizeContent } from "@/api/services";
import { type PricingRule, useDeletePricingRule, usePricingRules, useSavePricingRule } from "@/api/pricing";
import { ruleSummary } from "@/components/admin/pricing/format";
import { RuleForm } from "@/components/admin/pricing/rule-form";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { type TranslationKey, useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

type Kind = PricingRule["kind"];

// Même ordre que le calcul côté serveur : forfait groupe, période, chiens supplémentaires.
const SECTIONS: readonly [Kind, TranslationKey, TranslationKey, TranslationKey][] = [
  ["group", "pricing.kindGroup", "pricing.kindGroupHint", "pricing.addGroupRule"],
  ["off_peak", "pricing.kindOffPeak", "pricing.kindOffPeakHint", "pricing.addOffPeakRule"],
  ["extra_dog", "pricing.kindExtraDog", "pricing.kindExtraDogHint", "pricing.addExtraDogRule"],
];

export default function AdminPricingRulesRoute() {
  return (
    <AdminGuard>
      <PricingRules />
    </AdminGuard>
  );
}

function PricingRules() {
  const { t, language } = useLanguage();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const services = useAdminServices();
  const rules = usePricingRules(serviceId);
  const save = useSavePricingRule();
  const remove = useDeletePricingRule();
  const [editing, setEditing] = useState<{ kind: Kind; rule?: PricingRule } | null>(null);

  const service = services.data?.find((item) => item.id === serviceId);

  if (services.isLoading || rules.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (services.isError || rules.isError) {
    return (
      <Screen underHeader>
        <ErrorView
          error={services.error ?? rules.error}
          onRetry={() => {
            void services.refetch();
            void rules.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!service) {
    return (
      <Screen underHeader>
        <EmptyView title={t("notFound.service")} />
      </Screen>
    );
  }

  const all = rules.data ?? [];
  const nextSortOrder = all.reduce((max, rule) => Math.max(max, rule.sort_order + 1), 0);

  const toggle = (rule: PricingRule, active: boolean) => {
    const { id, created_at: _created, ...rest } = rule;
    save.mutate({ ...rest, id, active }, { onError: (err) => notify(t("pricing.active"), toUserMessage(err)) });
  };

  const askDelete = async (rule: PricingRule) => {
    const ok = await confirm({
      title: t("pricing.deleteTitle"),
      message: t("pricing.deleteMessage"),
      confirmLabel: t("pricing.deleteRule"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(rule.id, {
      onSuccess: () => {
        if (editing?.rule?.id === rule.id) setEditing(null);
      },
      onError: (err) => notify(t("pricing.deleteTitle"), toUserMessage(err)),
    });
  };

  return (
    <Screen
      underHeader
      heading={localizeContent(service, language).name}
      refreshing={rules.isRefetching}
      onRefresh={() => void rules.refetch()}
    >
      <Card>
        <AppText variant="bodyStrong">
          {service.price_cents == null
            ? t("pricing.noPrice")
            : t("pricing.basePrice", { price: formatPrice(service.price_cents) ?? "" })}
        </AppText>
        {service.price_cents == null ? (
          <AppText variant="body" style={styles.warning}>
            {t("pricing.noBasePriceWarning")}
          </AppText>
        ) : null}
      </Card>

      {SECTIONS.map(([kind, title, hint, addLabel]) => {
        const list = all.filter((rule) => rule.kind === kind);
        const formHere = editing?.kind === kind;
        return (
          <View key={kind} style={styles.section}>
            <AppText variant="heading">{t(title)}</AppText>
            <AppText variant="caption" style={styles.help}>
              {t(hint)}
            </AppText>
            {list.length === 0 && !formHere ? <AppText variant="body">{t("pricing.noRules")}</AppText> : null}
            {list.map((rule) =>
              formHere && editing?.rule?.id === rule.id ? (
                <RuleForm
                  key={rule.id}
                  serviceId={service.id}
                  kind={kind}
                  rule={rule}
                  sortOrder={nextSortOrder}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <Card key={rule.id}>
                  {rule.label ? <AppText variant="bodyStrong">{rule.label}</AppText> : null}
                  <AppText variant="body" style={!rule.active && styles.inactive}>
                    {ruleSummary(rule)}
                  </AppText>
                  <Checkbox
                    label={t("pricing.active")}
                    checked={rule.active}
                    onChange={(active) => toggle(rule, active)}
                  />
                  <View style={styles.actions}>
                    <Button
                      label={t("pricing.editRule")}
                      variant="secondary"
                      onPress={() => setEditing({ kind, rule })}
                    />
                    <Button
                      label={t("pricing.deleteRule")}
                      variant="dangerText"
                      loading={remove.isPending && remove.variables === rule.id}
                      onPress={() => void askDelete(rule)}
                    />
                  </View>
                </Card>
              ),
            )}
            {formHere && !editing?.rule ? (
              <RuleForm serviceId={service.id} kind={kind} sortOrder={nextSortOrder} onDone={() => setEditing(null)} />
            ) : (
              <Button label={t(addLabel)} variant="secondary" onPress={() => setEditing({ kind })} />
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md, marginTop: space.lg },
  help: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.sm },
  inactive: { opacity: 0.5 },
  warning: { color: colors.reserved },
});
