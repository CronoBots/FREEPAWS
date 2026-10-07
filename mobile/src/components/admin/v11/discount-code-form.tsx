import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useCreateDiscountCode, useUpdateDiscountCode } from "@/api/admin";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DateField } from "@/components/date-field";
import { Segmented } from "@/components/segmented";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import type { Tables } from "@/types/database";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

const CODE = /^[A-Z0-9-]{4,32}$/;

type Kind = "percent" | "amount";

/** Valeur affichée dans le champ : pourcentage tel quel, montant en euros (« 12,50 »). */
function initialValue(code: Tables<"discount_codes">) {
  if (code.kind === "percent") return String(code.value);
  return (code.value / 100).toFixed(code.value % 100 === 0 ? 0 : 2).replace(".", ",");
}

/** Formulaire d’un code de tarif social : création (sans `code`) ou modification d’un code existant. */
export function DiscountCodeForm({ code: existing, onDone }: { code?: Tables<"discount_codes">; onDone?: () => void }) {
  const { t } = useLanguage();
  const create = useCreateDiscountCode();
  const update = useUpdateDiscountCode();

  const [code, setCode] = useState(existing?.code ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [kind, setKind] = useState<Kind>(existing?.kind ?? "percent");
  const [value, setValue] = useState(existing ? initialValue(existing) : "");
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? "");
  const [maxUses, setMaxUses] = useState(existing?.max_uses != null ? String(existing.max_uses) : "");
  const [error, setError] = useState<string | null>(null);

  const valueLabel = t(kind === "percent" ? "pricing.codeValuePercent" : "pricing.codeValueAmount");
  const pending = create.isPending || update.isPending;

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
    const row = { code, label: label.trim(), kind, value: amount, valid_until: validUntil || null, max_uses: uses };
    const options = {
      onSuccess: () => {
        if (!existing) {
          setCode("");
          setLabel("");
          setValue("");
          setValidUntil("");
          setMaxUses("");
        }
        onDone?.();
      },
      onError: (err: unknown) => setError(toUserMessage(err)),
    };
    if (existing) update.mutate({ id: existing.id, ...row }, options);
    else create.mutate(row, options);
  };

  return (
    <Card>
      <AppText variant="heading">{existing ? t("pricing.editCodeTitle") : t("admin.newCode")}</AppText>
      <TextField
        label={t("admin.codeField")}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
        autoCapitalize="characters"
        maxLength={32}
      />
      <TextField label={t("admin.codeLabel")} value={label} onChangeText={setLabel} maxLength={120} />
      <View style={styles.group}>
        <AppText variant="bodyStrong">{t("pricing.discountKind")}</AppText>
        <Segmented<Kind>
          accessibilityLabel={t("pricing.discountKind")}
          options={[
            { value: "percent", label: t("admin.kindPercent") },
            { value: "amount", label: t("admin.kindAmount") },
          ]}
          value={kind}
          onChange={setKind}
        />
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
      <Button label={existing ? t("common.save") : t("admin.create")} loading={pending} onPress={submit} />
      {onDone && existing ? <Button label={t("common.cancel")} variant="ghost" onPress={onDone} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  error: { color: colors.danger },
});
