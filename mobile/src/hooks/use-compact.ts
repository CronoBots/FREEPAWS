import { useWindowDimensions } from "react-native";

/** Petit écran (iPhone SE, Android compacts) : on réduit les grands titres. */
export function useCompact() {
  return useWindowDimensions().width < 360;
}
