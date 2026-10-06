// Edge Function `live-stream` : délivre les URLs du direct du parc.
//
// 1. Appelle camera_access() avec le jeton de l'appelant (anonyme ou connecté) :
//    la base décide seule du mode (public / private / admin / denied).
// 2. Si l'accès est accordé, lit les caméras avec la clé service et signe chaque URL
//    avec une expiration courte. Le serveur vidéo doit vérifier la signature
//    (voir docs/CAMERA.md) : une URL copiée pendant que le parc était libre
//    cesse de fonctionner quand une réservation commence.
//
// Variables d'environnement (secrets Supabase) :
//   CAMERA_BASE_URL       ex. https://live.freepaws.be/hls
//   CAMERA_SIGNING_SECRET secret partagé avec le serveur vidéo
import { createClient } from "npm:@supabase/supabase-js@2";

const RESOURCE_SLUG = "park";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function sign(key: CryptoKey, payload: string): Promise<string> {
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = Deno.env.get("CAMERA_BASE_URL");
  const secret = Deno.env.get("CAMERA_SIGNING_SECRET");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_misconfigured" }, 500);

  // Client « au nom de l'appelant » : RLS et auth.uid() s'appliquent. Un visiteur non connecté
  // envoie la clé publishable (pas un JWT) en Bearer : on ne transmet que les vrais jetons de session.
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const isJwt = bearer.split(".").length === 3;
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: isJwt ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
    auth: { persistSession: false },
  });

  const { data: access, error: accessError } = await asCaller
    .rpc("camera_access", { p_resource_slug: RESOURCE_SLUG })
    .single<{ mode: "public" | "private" | "admin" | "denied"; expires_at: string | null }>();
  if (accessError) return json({ error: "access_check_failed" }, 502);

  if (access.mode === "denied" || !access.expires_at) {
    return json({ mode: "denied", streams: [] });
  }
  if (!baseUrl || !secret) {
    // Caméras pas encore installées : l'app affiche « direct bientôt disponible ».
    return json({ mode: access.mode, expiresAt: access.expires_at, streams: [] });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: cameras, error: camerasError } = await admin
    .from("cameras")
    .select("id, name, stream_path, resources!inner(slug)")
    .eq("resources.slug", RESOURCE_SLUG)
    .eq("active", true)
    .order("sort_order");
  if (camerasError) return json({ error: "cameras_unavailable" }, 502);

  const expires = Math.floor(new Date(access.expires_at).getTime() / 1000);
  const key = await importSigningKey(secret);
  // Signature dans le chemin (pas en query string) : les segments HLS sont résolus relativement à la
  // playlist et héritent donc du même préfixe signé.
  const streams = await Promise.all(
    (cameras ?? []).map(async (camera) => {
      const token = await sign(key, `${camera.stream_path}:${expires}`);
      return {
        id: camera.id,
        name: camera.name,
        url: `${baseUrl.replace(/\/$/, "")}/${expires}/${token}/${camera.stream_path}/index.m3u8`,
      };
    }),
  );

  return json({ mode: access.mode, expiresAt: access.expires_at, streams });
});
