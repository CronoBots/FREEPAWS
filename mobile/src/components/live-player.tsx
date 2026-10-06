import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

/** Lecture d’un flux HLS en direct (URL signée à durée courte). */
export function LivePlayer({ url, label }: { url: string; label: string }) {
  const player = useVideoPlayer({ uri: url, contentType: "hls" }, (instance) => {
    instance.muted = true;
    instance.loop = false;
    instance.play();
  });

  return (
    <View style={styles.frame}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        accessibilityLabel={`Direct vidéo : ${label}`}
      />
      <View style={styles.liveTag}>
        <View style={styles.liveDot} />
        <AppText variant="caption" style={styles.liveText}>
          EN DIRECT · {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.ink, aspectRatio: 16 / 9 },
  video: { flex: 1 },
  liveTag: {
    position: "absolute",
    top: space.sm,
    left: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(43, 58, 48, 0.75)",
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e0533d" },
  liveText: { color: colors.cream, fontWeight: "600" },
});
