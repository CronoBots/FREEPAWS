import * as SecureStore from "expo-secure-store";

// La session Supabase dépasse la limite de taille d’une entrée SecureStore (~2 Ko) :
// on la découpe en morceaux, tous stockés dans le trousseau iOS / Keystore Android.
const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const count = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === 0) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    return parts.some((part) => part === null) ? null : parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await readCount(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    for (let i = chunks.length; i < previous; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
