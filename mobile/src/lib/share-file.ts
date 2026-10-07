import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Crée un fichier texte (CSV, JSON) et ouvre la feuille de partage du téléphone. */
export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
