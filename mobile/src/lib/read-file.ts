import { File } from "expo-file-system";

/** Contenu d’un fichier local choisi par l’utilisateur (natif). */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
