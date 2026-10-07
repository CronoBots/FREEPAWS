import { useState } from "react";
import { StyleSheet } from "react-native";

import { useTotpFactors, useVerifyTotp } from "@/api/mfa";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { colors } from "@/theme";
import { toUserMessage } from "@/utils/errors";

/** Demande le code de l’application d’authentification avant d’ouvrir l’administration. */
export function MfaChallenge() {
  const { t } = useLanguage();
  const factors = useTotpFactors();
  const verify = useVerifyTotp();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const factor = factors.data?.find((item) => item.status === "verified");

  const submit = () => {
    setError(null);
    if (!factor || !/^\d{6}$/.test(code)) return setError(t("mfa.codeInvalid"));
    verify.mutate(
      { factorId: factor.id, code },
      {
        onError: (err) =>
          setError(toUserMessage(err) === t("common.error") ? t("mfa.codeInvalid") : toUserMessage(err)),
      },
    );
  };

  return (
    <Screen underHeader>
      <Card>
        <AppText variant="heading">{t("mfa.challengeTitle")}</AppText>
        <AppText variant="body">{t("mfa.challengeText")}</AppText>
        <TextField
          label={t("mfa.code")}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          onSubmitEditing={submit}
        />
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("mfa.verify")} loading={verify.isPending} disabled={!factor} onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
});
