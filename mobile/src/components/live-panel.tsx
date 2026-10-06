import { StyleSheet, View } from "react-native";

import { type ParkStatus, useLiveStream } from "@/api/park";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

/** Caméra à deux temps (textes de freepaws.be/journal-de-bord.html). */
export function LivePanel({ status, statusFailed }: { status: ParkStatus | undefined; statusFailed: boolean }) {
  const parkOpen = Boolean(status) && status?.status !== "not_open";
  const live = useLiveStream(parkOpen);

  if (status?.status === "not_open") {
    return (
      <Card>
        <AppText variant="eyebrow">L’accès pensé pour la liberté et la sécurité</AppText>
        <AppText variant="body">Une fois ouvert, le parc fonctionnera avec un système de caméra à deux temps.</AppText>
        <AppText variant="bodyStrong">Parc libre</AppText>
        <AppText variant="body">
          Consultez le direct pour découvrir le parc à tout moment : sa disponibilité, mais aussi son état du moment —
          pluie, neige, terrain praticable — avant de vous déplacer.
        </AppText>
        <AppText variant="bodyStrong">Parc réservé</AppText>
        <AppText variant="body">
          L’accès devient privé, conformément à la protection de la vie privée. Vous gardez un œil sur votre chien —
          utile si le rappel n’est pas encore acquis — et je garde un accès en cas d’incident.
        </AppText>
      </Card>
    );
  }

  let body;
  if (statusFailed) {
    body = <Placeholder title="Direct indisponible" />;
  } else if (!status || live.isLoading) {
    body = <LoadingView label="Connexion au direct…" />;
  } else if (live.isError) {
    body = <Placeholder title="Direct indisponible" />;
  } else if (!live.data || live.data.mode === "denied") {
    body =
      status.status === "reserved" ? (
        <Placeholder
          title="Parc réservé"
          message="L’accès devient privé, conformément à la protection de la vie privée."
        />
      ) : (
        <Placeholder title="Parc fermé" />
      );
  } else if (live.data.streams.length === 0) {
    body = <Placeholder title="Direct indisponible" />;
  } else {
    body = (
      <View style={styles.streams}>
        {live.data.streams.map((stream) => (
          <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
        ))}
      </View>
    );
  }

  return (
    <Card>
      <AppText variant="eyebrow">Caméra</AppText>
      {body}
    </Card>
  );
}

function Placeholder({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.placeholder}>
      <AppText variant="heading" style={styles.placeholderText}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" style={[styles.placeholderText, styles.placeholderBody]}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  streams: { gap: space.sm },
  placeholder: {
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
  },
  placeholderText: { color: colors.cream, textAlign: "center" },
  placeholderBody: { opacity: 0.85, fontSize: 14, lineHeight: 20 },
});
