import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { useDeleteAccount, useIsAdmin, useProfile } from "@/api/profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { confirm, notify } from "@/lib/confirm";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export default function AccountScreen() {
  const { userId } = useAuth();
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const deleteAccount = useDeleteAccount();

  const onDelete = async () => {
    const ok = await confirm({
      title: "Supprimer votre compte ?",
      message:
        "Vos réservations à venir seront annulées et vos données (profil, chiens, historique) définitivement effacées.",
      confirmLabel: "Supprimer définitivement",
      destructive: true,
    });
    if (!ok) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => notify("Compte supprimé", "Vos données ont été effacées. À bientôt peut-être !"),
      onError: (error) => notify("Suppression impossible", toUserMessage(error)),
    });
  };

  return (
    <Screen title="Compte">
      {userId ? (
        <Card>
          <AppText variant="heading">{profile.data?.full_name || "Bienvenue"}</AppText>
          <AppText variant="body">{profile.data?.email}</AppText>
        </Card>
      ) : (
        <Card>
          <AppText variant="heading">Pas encore de compte ?</AppText>
          <AppText variant="body">Un simple code reçu par email suffit pour réserver et suivre vos sessions.</AppText>
          <Button label="Se connecter ou créer un compte" onPress={() => router.push("/sign-in")} />
        </Card>
      )}

      <View>
        {userId ? (
          <>
            <ListRow label="Mes informations" detail="Nom, téléphone" onPress={() => router.push("/profile")} />
            <ListRow label="Mes chiens" onPress={() => router.push("/dogs")} />
            {isAdmin ? (
              <ListRow
                label="Agenda (administration)"
                detail="Toutes les réservations"
                onPress={() => router.push("/admin")}
              />
            ) : null}
          </>
        ) : null}
        <ListRow
          label="Nous contacter"
          detail={env.contactEmail}
          onPress={() => void Linking.openURL(`mailto:${env.contactEmail}`)}
        />
        <ListRow label="Site FreePaws" detail="freepaws.be" onPress={() => void Linking.openURL(env.websiteUrl)} />
        <ListRow label="Confidentialité et conditions" onPress={() => router.push("/legal")} />
        {userId ? (
          <>
            <ListRow label="Se déconnecter" onPress={() => void supabase.auth.signOut()} />
            <ListRow label="Supprimer mon compte" destructive onPress={() => void onDelete()} />
          </>
        ) : null}
      </View>

      <AppText variant="caption" style={styles.version}>
        FreePaws {Constants.expoConfig?.version ?? ""}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: { textAlign: "center", marginTop: space.lg },
});
