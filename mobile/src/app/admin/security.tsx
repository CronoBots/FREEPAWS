import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { useEnrollTotp, useTotpFactors, useUnenrollTotp, useVerifyTotp } from "@/api/mfa";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, fonts, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

type Enrollment = { factorId: string; qrCode: string; secret: string; uri: string };

/**
 * Supabase renvoie « data:image/svg+xml;utf-8,<svg…> » avec le SVG brut : on l’encode pour que
 * l’URL reste valide (caractères « # », espaces) sur le web comme sur mobile.
 */
function svgDataUri(qrCode: string): string {
  const comma = qrCode.indexOf(",");
  if (comma < 0 || /;base64,/.test(qrCode)) return qrCode;
  const svg = qrCode.slice(comma + 1);
  const raw = svg.trimStart().startsWith("<") ? svg : decodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
}

export default function AdminSecurityRoute() {
  return (
    <AdminGuard>
      <Security />
    </AdminGuard>
  );
}

function Security() {
  const { t } = useLanguage();
  const factors = useTotpFactors();
  const verified = factors.data?.find((factor) => factor.status === "verified");

  return (
    <Screen underHeader refreshing={factors.isRefetching} onRefresh={() => void factors.refetch()}>
      <Card>
        <View style={styles.head}>
          <AppText variant="heading" style={styles.flex}>
            {t("adminSafety.securityTitle")}
          </AppText>
          {factors.data ? (
            <Badge
              label={verified ? t("adminSafety.statusOn") : t("adminSafety.statusOff")}
              tone={verified ? "success" : "neutral"}
            />
          ) : null}
        </View>
        <AppText variant="body">{t("adminSafety.securityIntro")}</AppText>
      </Card>

      {factors.isLoading ? (
        <LoadingView />
      ) : factors.isError ? (
        <ErrorView error={factors.error} onRetry={() => void factors.refetch()} />
      ) : verified ? (
        <Enabled factorId={verified.id} />
      ) : (
        <Activation />
      )}
    </Screen>
  );
}

function Enabled({ factorId }: { factorId: string }) {
  const { t } = useLanguage();
  const unenroll = useUnenrollTotp();
  const [error, setError] = useState<string | null>(null);

  const disable = async () => {
    const ok = await confirm({
      title: t("adminSafety.disableTitle"),
      message: t("adminSafety.disableText"),
      confirmLabel: t("adminSafety.disable"),
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    unenroll.mutate(factorId, { onError: (err) => setError(toUserMessage(err)) });
  };

  return (
    <Card>
      <AppText variant="body">{t("adminSafety.enabledText")}</AppText>
      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button
        label={t("adminSafety.disable")}
        variant="secondary"
        loading={unenroll.isPending}
        onPress={() => void disable()}
      />
    </Card>
  );
}

function Activation() {
  const { t } = useLanguage();
  const enroll = useEnrollTotp();
  const verify = useVerifyTotp();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setError(null);
    setQrFailed(false);
    enroll.mutate(undefined, {
      onSuccess: (data) => setEnrollment(data),
      onError: (err) => setError(toUserMessage(err)),
    });
  };

  const copyKey = async () => {
    if (!enrollment) return;
    await Clipboard.setStringAsync(enrollment.secret);
    notify(t("adminSafety.keyCopied"), t("adminSafety.keyCopiedText"));
  };

  const submit = () => {
    setError(null);
    if (!enrollment || !/^\d{6}$/.test(code)) return setError(t("mfa.codeInvalid"));
    verify.mutate(
      { factorId: enrollment.factorId, code },
      {
        onSuccess: () => notify(t("adminSafety.activated"), t("adminSafety.enabledText")),
        onError: (err) =>
          setError(toUserMessage(err) === t("common.error") ? t("mfa.codeInvalid") : toUserMessage(err)),
      },
    );
  };

  if (!enrollment) {
    return (
      <Card>
        <AppText variant="body">{t("adminSafety.afterText")}</AppText>
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("adminSafety.activate")} loading={enroll.isPending} onPress={start} />
      </Card>
    );
  }

  return (
    <Card>
      <AppText variant="bodyStrong">{t("adminSafety.step1")}</AppText>
      {!qrFailed ? (
        <View style={styles.qrBox}>
          <Image
            source={{ uri: svgDataUri(enrollment.qrCode) }}
            style={styles.qr}
            contentFit="contain"
            accessibilityLabel={t("adminSafety.qrLabel")}
            onError={() => setQrFailed(true)}
          />
        </View>
      ) : null}
      <AppText variant="body">{t("adminSafety.secretLabel")}</AppText>
      <AppText selectable style={styles.secret}>
        {enrollment.secret.replace(/(.{4})(?=.)/g, "$1 ")}
      </AppText>
      <Button label={t("adminSafety.copyKey")} variant="secondary" onPress={() => void copyKey()} />
      {Platform.OS !== "web" ? (
        <Button
          label={t("adminSafety.openApp")}
          variant="ghost"
          onPress={() => void Linking.openURL(enrollment.uri).catch((err: unknown) => setError(toUserMessage(err)))}
        />
      ) : null}

      <AppText variant="bodyStrong" style={styles.step}>
        {t("adminSafety.step2")}
      </AppText>
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
      <Button label={t("adminSafety.confirmActivation")} loading={verify.isPending} onPress={submit} />
      <AppText variant="caption">{t("adminSafety.afterText")}</AppText>
      <Button
        label={t("common.cancel")}
        variant="ghost"
        onPress={() => {
          setEnrollment(null);
          setCode("");
          setError(null);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  flex: { flexGrow: 1, flexShrink: 1 },
  qrBox: {
    alignSelf: "center",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  qr: { width: 200, height: 200 },
  secret: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  step: { marginTop: space.sm, fontFamily: fonts.sansMedium },
  error: { color: colors.danger },
});
