import { StyleSheet, View } from "react-native";

import { useResources } from "@/api/admin";
import { Chip } from "@/components/chip";
import { useLanguage } from "@/i18n";
import { space } from "@/theme";

/** Choix de la ressource gérée : l’agenda du coaching ou celui du parc. */
export function ResourceSwitch({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { t } = useLanguage();
  const resources = useResources();
  return (
    <View style={styles.row}>
      {resources.data?.map((resource) => (
        <Chip
          key={resource.id}
          label={resource.slug === "park" ? t("admin.resourcePark") : t("admin.resourceCoach")}
          selected={value === resource.id}
          onPress={() => onChange(resource.id)}
        />
      ))}
    </View>
  );
}

export function useDefaultResource(selected: string | null) {
  const resources = useResources();
  return selected ?? resources.data?.find((resource) => resource.slug === "coach")?.id ?? null;
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm } });
