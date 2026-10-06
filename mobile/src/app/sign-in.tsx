import { router } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { supabase } from "@/lib/supabase";
import { toUserMessage } from "@/utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInRoute() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const codeInput = useRef<TextInput>(null);

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Saisissez une adresse email valide.");
      return;
    }
    setBusy(true);
    setError(undefined);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (authError) {
      setError(toUserMessage(authError));
      return;
    }
    setEmail(address);
    setStep("code");
    setTimeout(() => codeInput.current?.focus(), 250);
  };

  const verify = async () => {
    setBusy(true);
    setError(undefined);
    const { data, error: authError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (authError || !data.user) {
      setBusy(false);
      setError(toUserMessage(authError ?? { code: "otp_expired" }));
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
    setBusy(false);
    if (!profile?.full_name) router.replace({ pathname: "/profile", params: { welcome: "1" } });
    else router.back();
  };

  return (
    <Screen underHeader>
      {step === "email" ? (
        <>
          <AppText variant="title">Bienvenue</AppText>
          <AppText variant="body">
            Saisissez votre email : nous vous envoyons un code à 6 chiffres. Pas de mot de passe à retenir.
          </AppText>
          <TextField
            label="Adresse email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            error={error}
          />
          <Button label="Recevoir mon code" loading={busy} onPress={() => void sendCode()} />
          <AppText variant="caption">
            En continuant, vous acceptez nos conditions d’utilisation et notre politique de confidentialité.
          </AppText>
          <Button label="Lire la politique de confidentialité" variant="ghost" onPress={() => router.push("/legal")} />
        </>
      ) : (
        <>
          <AppText variant="title">Vérifiez vos emails</AppText>
          <AppText variant="body">Nous avons envoyé un code à {email}. Il est valable 10 minutes.</AppText>
          <TextField
            ref={codeInput}
            label="Code à 6 chiffres"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => void verify()}
            error={error}
          />
          <Button label="Se connecter" loading={busy} disabled={code.length !== 6} onPress={() => void verify()} />
          <Button
            label="Changer d'adresse ou renvoyer un code"
            variant="ghost"
            onPress={() => {
              setStep("email");
              setCode("");
              setError(undefined);
            }}
          />
        </>
      )}
    </Screen>
  );
}
