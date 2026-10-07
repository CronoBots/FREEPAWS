import * as DocumentPicker from "expo-document-picker";
import { Linking } from "react-native";

import { readFileBytes } from "@/lib/read-file";
import { supabase } from "@/lib/supabase";

export type Bucket = "proofs" | "incidents";
export type PickedFile = { uri: string; name: string; mimeType: string; size: number | null; file?: File };

const MAX_BYTES = 10 * 1024 * 1024;

/** Ouvre le sélecteur de fichiers (PDF ou photo par défaut). Null si l’utilisateur annule. */
export async function pickFile(kind: "proof" | "image" = "proof"): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: kind === "image" ? ["image/*"] : ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size ?? null,
    file: asset.file,
  };
}

/**
 * Téléverse un fichier dans un bucket privé et retourne son chemin.
 * Les justificatifs vont dans le dossier de l’utilisateur (`<userId>/…`), exigé par les règles d’accès.
 */
export async function uploadFile(bucket: Bucket, folder: string, picked: PickedFile): Promise<string> {
  if (picked.size != null && picked.size > MAX_BYTES) throw new Error("file_too_large");
  const body = picked.file ?? (await readFileBytes(picked.uri));
  if (body instanceof ArrayBuffer && body.byteLength > MAX_BYTES) throw new Error("file_too_large");
  const extension = (picked.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: picked.mimeType });
  if (error) throw error;
  return path;
}

/** Ouvre un fichier privé via une URL signée valable 5 minutes. */
export async function openStoredFile(bucket: Bucket, path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error) throw error;
  await Linking.openURL(data.signedUrl);
}

export async function removeStoredFile(bucket: Bucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}
