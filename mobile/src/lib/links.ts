import { env } from "@/lib/env";

/** Lien vers une page de l’app : adresse web si l’app est publiée, sinon ouverture de l’app installée. */
export function appLink(path: string): string {
  const clean = path.replace(/^\//, "");
  return env.appUrl ? `${env.appUrl}/${clean}` : `freepaws://${clean}`;
}
