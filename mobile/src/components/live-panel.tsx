import { StyleSheet, View } from "react-native";

import { type ParkStatus, useLiveStream } from "@/api/park";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

/** Caméra à deux temps : publique quand le parc est libre, privée pendant une session. */
export function LivePanel({ status }: { status: ParkStatus | undefined }) {
  const live = useLiveStream(Boolean(status));

  let body;
  if (!status || live.isLoading) {
    body = <LoadingView label="Connexion au direct…" />;
  } else if (live.isError) {
    body = <Placeholder title="Direct indisponible" message="Impossible de joindre la caméra pour le moment." />;
  } else if (!live.data || live.data.mode === "denied") {
    body =
      status.status === "reserved" ? (
        <Placeholder
          title="Session privée en cours"
          message="Par respect pour la famille présente, le direct est réservé à la personne qui a réservé ce créneau."
        />
      ) : (
        <Placeholder title="Parc fermé" message="Le direct reprend à l'ouverture du parc." />
      );
  } else if (live.data.streams.length === 0) {
    body = (
      <Placeholder
        title="Direct bientôt disponible"
        message="Les caméras seront installées avec l'ouverture du parc. Vous pourrez alors vérifier en direct s'il est libre et l'état du terrain."
      />
    );
  } else {
    body = (
      <View style={styles.streams}>
        {live.data.streams.map((stream) => (
          <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
        ))}
        <AppText variant="caption">
          {live.data.mode === "private"
            ? "Direct privé : visible uniquement par vous pendant votre session."
            : "Direct public : il devient privé dès qu'une session réservée commence."}
        </AppText>
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

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.placeholder}>
      <AppText variant="heading" style={styles.placeholderText}>
        {title}
      </AppText>
      <AppText variant="body" style={[styles.placeholderText, styles.placeholderBody]}>
        {message}
      </AppText>
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
