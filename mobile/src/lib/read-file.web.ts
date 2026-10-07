/** Contenu d’un fichier choisi par l’utilisateur (web : URL blob). */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}
