import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  useDeleteDiscountCode,
  useDiscountCodes,
  useSettings,
  useUpdateDiscountCode,
  useUpdateSettings,
} from "@/api/admin";
import { DiscountCodeForm } from "@/components/admin/v11/discount-code-form";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import type { Tables } from "@/types/database";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

export default function AdminDiscountsRoute() {
  return (
    <AdminGuard>
      <Discounts />
    </AdminGuard>
  );
}

function Discounts() {
  const { t } = useLanguage();
  const codes = useDiscountCodes();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  // Code en cours de modification (un seul formulaire ouvert à la fois).
  const [editing, setEditing] = useState<string | null>(null);

  const [cap, setCap] = useState<string | null>(null);
  const [capError, setCapError] = useState<string | null>(null);

  const capValue = cap ?? (settings.data?.social_monthly_cap == null ? "" : String(settings.data.social_monthly_cap));

  const saveCap = () => {
    setCapError(null);
    const parsed = capValue.trim() === "" ? null : Number(capValue);
    if (parsed != null && (!Number.isInteger(parsed) || parsed < 0)) {
      return setCapError(t("admin.invalidNumber", { field: t("pricing.capField") }));
    }
    updateSettings.mutate(
      { social_monthly_cap: parsed },
      { onSuccess: () => notify(t("admin.saved"), ""), onError: (err) => setCapError(toUserMessage(err)) },
    );
  };

  return (
    <Screen underHeader refreshing={codes.isRefetching} onRefresh={() => void codes.refetch()}>
      <AppText variant="heading">{t("pricing.codesTitle")}</AppText>
      {codes.isLoading ? (
        <LoadingView />
      ) : codes.isError ? (
        <ErrorView error={codes.error} onRetry={() => void codes.refetch()} />
      ) : codes.data?.length === 0 ? (
        <AppText variant="body">{t("admin.noCodes")}</AppText>
      ) : (
        codes.data?.map((item) => {
          const { bookings, ...code } = item;
          const uses = (bookings as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
          return editing === item.id ? (
            <DiscountCodeForm key={item.id} code={code} onDone={() => setEditing(null)} />
          ) : (
            <CodeCard key={item.id} code={code} uses={uses} onEdit={() => setEditing(item.id)} />
          );
        })
      )}

      <DiscountCodeForm />

      <Card>
        <AppText variant="heading">{t("pricing.capTitle")}</AppText>
        <AppText variant="body">{t("pricing.capHint")}</AppText>
        <TextField
          label={t("pricing.capField")}
          value={capValue}
          onChangeText={(text) => setCap(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
        />
        {capError ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {capError}
          </AppText>
        ) : null}
        <Button label={t("common.save")} variant="secondary" loading={updateSettings.isPending} onPress={saveCap} />
      </Card>
    </Screen>
  );
}

function CodeCard({ code, uses, onEdit }: { code: Tables<"discount_codes">; uses: number; onEdit: () => void }) {
  const { t, tp } = useLanguage();
  const updateCode = useUpdateDiscountCode();
  const remove = useDeleteDiscountCode();

  // Un code déjà utilisé ne se supprime pas (les réservations y renvoient) : il se désactive.
  const askDelete = async () => {
    const ok = await confirm({
      title: t("pricing.deleteCodeTitle"),
      message: t("pricing.deleteCodeMessage", { code: code.code }),
      confirmLabel: t("admin.delete"),
      destructive: true,
    });
    if (ok) remove.mutate(code.id, { onError: (err) => notify(t("pricing.deleteCodeTitle"), toUserMessage(err)) });
  };

  return (
    <Card>
      <AppText variant="heading">{code.code}</AppText>
      {code.label ? <AppText variant="body">{code.label}</AppText> : null}
      <AppText variant="caption">
        {[
          code.kind === "percent"
            ? t("pricing.percentValue", { value: `−${code.value}` })
            : `−${formatPrice(code.value) ?? ""}`,
          code.valid_until ? t("pricing.codeValidUntil", { date: formatDate(`${code.valid_until}T12:00:00Z`) }) : null,
          code.max_uses ? tp("pricing.codeMaxUses", code.max_uses) : null,
          tp("admin.codeUses", uses),
        ]
          .filter(Boolean)
          .join("\u00a0· ")}
      </AppText>
      <Checkbox
        label={t("admin.codeActive")}
        checked={code.active}
        onChange={(active) =>
          updateCode.mutate(
            { id: code.id, active },
            { onError: (err) => notify(t("admin.codeActive"), toUserMessage(err)) },
          )
        }
      />
      <View style={styles.actions}>
        <Button label={t("pricing.editCode")} variant="secondary" style={styles.edit} onPress={onEdit} />
        {uses === 0 ? (
          <Button
            label={t("admin.delete")}
            variant="dangerText"
            style={styles.delete}
            loading={remove.isPending}
            onPress={() => void askDelete()}
          />
        ) : null}
      </View>
      {uses > 0 ? <AppText variant="caption">{t("pricing.codeUsedHint")}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  // Même disposition que les autres écrans admin : Modifier, puis Supprimer en rouge à côté.
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
  edit: { minWidth: 130 },
  delete: { paddingHorizontal: space.md },
});
