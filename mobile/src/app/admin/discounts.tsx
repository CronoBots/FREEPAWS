import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  useCreateDiscountCode,
  useDiscountCodes,
  useSettings,
  useUpdateDiscountCode,
  useUpdateSettings,
} from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { DateField } from "@/components/date-field";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

const CODE = /^[A-Z0-9-]{4,32}$/;

export default function AdminDiscountsRoute() {
  return (
    <AdminGuard>
      <Discounts />
    </AdminGuard>
  );
}

function Discounts() {
  const { t, tp } = useLanguage();
  const codes = useDiscountCodes();
  const create = useCreateDiscountCode();
  const updateCode = useUpdateDiscountCode();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [cap, setCap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capError, setCapError] = useState<string | null>(null);

  const capValue = cap ?? (settings.data?.social_monthly_cap == null ? "" : String(settings.data.social_monthly_cap));
  const valueLabel = t(kind === "percent" ? "pricing.codeValuePercent" : "pricing.codeValueAmount");

  const submit = () => {
    setError(null);
    if (!CODE.test(code)) return setError(t("admin.invalidCode"));
    const amount = kind === "percent" ? Number(value) : Math.round(Number(value.replace(",", ".")) * 100);
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0 || (kind === "percent" && amount > 100)) {
      return setError(t("admin.invalidNumber", { field: valueLabel }));
    }
    const uses = maxUses ? Number(maxUses) : null;
    if (uses != null && (!Number.isInteger(uses) || uses < 1)) {
      return setError(t("admin.invalidNumber", { field: t("admin.maxUses") }));
    }
    create.mutate(
      { code, label: label.trim(), kind, value: amount, valid_until: validUntil || null, max_uses: uses },
      {
        onSuccess: () => {
          setCode("");
          setLabel("");
          setValue("");
          setValidUntil("");
          setMaxUses("");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

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
          const uses = (item.bookings as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
          return (
            <Card key={item.id}>
              <AppText variant="heading">{item.code}</AppText>
              {item.label ? <AppText variant="body">{item.label}</AppText> : null}
              <AppText variant="caption" style={styles.help}>
                {[
                  item.kind === "percent"
                    ? t("pricing.percentValue", { value: `−${item.value}` })
                    : `−${formatPrice(item.value) ?? ""}`,
                  item.valid_until
                    ? t("pricing.codeValidUntil", { date: formatDate(`${item.valid_until}T12:00:00Z`) })
                    : null,
                  item.max_uses ? tp("pricing.codeMaxUses", item.max_uses) : null,
                  tp("admin.codeUses", uses),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
              <Checkbox
                label={t("admin.codeActive")}
                checked={item.active}
                onChange={(active) => updateCode.mutate({ id: item.id, active })}
              />
            </Card>
          );
        })
      )}

      <Card>
        <AppText variant="heading">{t("admin.newCode")}</AppText>
        <TextField
          label={t("admin.codeField")}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
          autoCapitalize="characters"
          maxLength={32}
        />
        <TextField label={t("admin.codeLabel")} value={label} onChangeText={setLabel} maxLength={120} />
        <AppText variant="bodyStrong">{t("pricing.discountKind")}</AppText>
        <View style={styles.chips}>
          <Chip label={t("admin.kindPercent")} selected={kind === "percent"} onPress={() => setKind("percent")} />
          <Chip label={t("admin.kindAmount")} selected={kind === "amount"} onPress={() => setKind("amount")} />
        </View>
        <TextField label={valueLabel} value={value} onChangeText={setValue} keyboardType="decimal-pad" maxLength={8} />
        <DateField label={t("pricing.validUntilField")} value={validUntil} onChange={setValidUntil} />
        <TextField
          label={t("admin.maxUses")}
          hint={t("pricing.maxUsesHint")}
          value={maxUses}
          onChangeText={(text) => setMaxUses(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
        />
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("admin.create")} loading={create.isPending} onPress={submit} />
      </Card>

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

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  help: { fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger },
});
