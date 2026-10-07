import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import {
  type ClientDetails,
  type IncidentKind,
  isActiveSanction,
  type UserRole,
  useClient,
  useSetUserRole,
} from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { ClientDogs } from "@/components/admin/clients/client-dogs";
import { ClientHistory } from "@/components/admin/clients/client-history";
import { ClientSanctions, type SanctionIncident } from "@/components/admin/clients/client-sanctions";
import { ClientBookingForm } from "@/components/admin/extra/client-booking-form";
import {
  BadgeRow,
  dayDate,
  InfoLine,
  keepTogether,
  openProof,
  Section,
  todayIso,
  validity,
} from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { type TranslationKey, useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDate, formatDateTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { parseRange } from "@/utils/range";

export default function AdminClientRoute() {
  return (
    <AdminGuard>
      <ClientScreen />
    </AdminGuard>
  );
}

function ClientScreen() {
  const { t } = useLanguage();
  // « incident » : fiche ouverte depuis un incident pour appliquer une sanction qui lui est liée.
  const { id, incident } = useLocalSearchParams<{ id: string; incident?: string }>();
  const client = useClient(id);

  if (client.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (client.isError) {
    const notFound = (client.error as { code?: string } | null)?.code === "PGRST116";
    return (
      <Screen underHeader>
        {notFound ? (
          <EmptyView title={t("adminClients.notFound")} />
        ) : (
          <ErrorView error={client.error} onRetry={() => void client.refetch()} />
        )}
      </Screen>
    );
  }
  const data = client.data;
  if (!data?.profile) {
    return (
      <Screen underHeader>
        <EmptyView title={t("adminClients.notFound")} />
      </Screen>
    );
  }
  return (
    <ClientContent
      data={{ ...data, profile: data.profile }}
      incidentId={incident}
      refreshing={client.isRefetching}
      onRefresh={() => void client.refetch()}
    />
  );
}

type Profile = NonNullable<ClientDetails["profile"]>;
type Details = Omit<ClientDetails, "profile"> & { profile: Profile };

function ClientContent({
  data,
  incidentId,
  refreshing,
  onRefresh,
}: {
  data: Details;
  incidentId?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const { profile, dogs, sanctions, incidents, history, bookings } = data;
  const name = profile.full_name?.trim() || profile.email;
  const dogNames = useMemo(() => new Map(dogs.map((dog) => [dog.id, dog.name])), [dogs]);
  const source = incidentId ? incidents.find((item) => item.id === incidentId) : undefined;
  const sanctionIncident: SanctionIncident | undefined = source
    ? { id: source.id, date: source.occurred_at, kindLabel: t(KINDS[source.kind]) }
    : undefined;
  const sanctionsSection = <ClientSanctions userId={profile.id} sanctions={sanctions} incident={sanctionIncident} />;

  return (
    <Screen underHeader heading={name} refreshing={refreshing} onRefresh={onRefresh}>
      <StatusBadges data={data} />
      {/* Depuis un incident : la sanction est le sujet, elle passe en tête de fiche. */}
      {sanctionIncident ? sanctionsSection : null}
      <Identity profile={profile} />
      <Insurance profile={profile} />
      <ClientDogs dogs={dogs} />
      {sanctionIncident ? null : sanctionsSection}
      <RoleSection profile={profile} />
      <Incidents incidents={incidents} />
      <ClientBookingForm clientId={profile.id} />
      <Bookings bookings={bookings} />
      <ClientHistory history={history} dogNames={dogNames} />
    </Screen>
  );
}

function StatusBadges({ data }: { data: Details }) {
  const { t } = useLanguage();
  const active = data.sanctions.filter((sanction) => isActiveSanction(sanction));
  const banned = active.some((sanction) => sanction.level === "ban");
  const suspended = !banned && active.some((sanction) => sanction.level === "suspension");
  const protocol = data.dogs.some((dog) => dog.protocol);
  if (data.profile.role !== "admin" && !banned && !suspended && !protocol) return null;
  return (
    <BadgeRow>
      {data.profile.role === "admin" ? <Badge label={t("adminClients.badgeAdmin")} /> : null}
      {banned ? <Badge label={t("adminClients.badgeBanned")} tone="danger" /> : null}
      {suspended ? <Badge label={t("adminClients.badgeSuspended")} tone="danger" /> : null}
      {protocol ? <Badge label={t("adminClients.badgeProtocol")} tone="danger" /> : null}
    </BadgeRow>
  );
}

function isMinor(birthDate: string) {
  const [y, m, d] = birthDate.split("-");
  return `${Number(y) + 18}-${m}-${d}` > todayIso();
}

/**
 * Adresse e-mail : la partie « @domaine » passe à la ligne d’un bloc si la place manque, au lieu d’une
 * coupure au milieu du domaine.
 */
function Email({ email }: { email: string }) {
  const at = email.lastIndexOf("@");
  if (at <= 0) {
    return (
      <AppText variant="body" style={styles.ink} selectable>
        {email}
      </AppText>
    );
  }
  return (
    <View style={styles.email} accessible accessibilityLabel={email}>
      <AppText variant="body" style={styles.ink} selectable>
        {email.slice(0, at)}
      </AppText>
      <AppText variant="body" style={styles.ink} selectable>
        {email.slice(at)}
      </AppText>
    </View>
  );
}

function Identity({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
  // « Appeler » et « Envoyer un e-mail » côte à côte, de même largeur ; empilés sur très petit écran.
  const narrow = useWindowDimensions().width < 340;
  const emergency = [
    profile.emergency_contact_name,
    profile.emergency_contact_phone ? keepTogether(profile.emergency_contact_phone) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Section title={t("adminClients.identity")}>
      <Email email={profile.email} />
      <AppText variant="body" style={styles.ink} selectable>
        {profile.phone ? keepTogether(profile.phone) : t("adminClients.noPhone")}
      </AppText>
      <View style={[styles.actions, narrow && styles.actionsStacked]}>
        {profile.phone ? (
          <Button
            label={t("adminClients.call")}
            variant="secondary"
            style={narrow ? undefined : styles.action}
            onPress={() => void Linking.openURL(`tel:${profile.phone!.replace(/[^\d+]/g, "")}`)}
          />
        ) : null}
        <Button
          label={t("adminClients.write")}
          variant="secondary"
          style={narrow ? undefined : styles.action}
          onPress={() => void Linking.openURL(`mailto:${profile.email}`)}
        />
      </View>
      <View style={styles.wrapRow}>
        <AppText variant="body">
          {profile.birth_date
            ? t("adminClients.birthDate", { date: formatDate(dayDate(profile.birth_date)) })
            : t("adminClients.noBirthDate")}
        </AppText>
        {profile.birth_date ? (
          isMinor(profile.birth_date) ? (
            <Badge label={t("adminClients.minor")} tone="warning" />
          ) : (
            <Badge label={t("adminClients.adult")} />
          )
        ) : null}
      </View>
      <InfoLine label={t("adminClients.emergencyContact")} value={emergency} />
      <AppText variant="caption">{t("adminClients.memberSince", { date: formatDate(profile.created_at) })}</AppText>
    </Section>
  );
}

function Insurance({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
  const status = validity(profile.insurance_valid_until);
  const badge = {
    valid: { label: t("adminClients.insuranceValid"), tone: "success" as const },
    expiring: { label: t("adminClients.insuranceExpiring"), tone: "warning" as const },
    expired: { label: t("adminClients.insuranceExpired"), tone: "danger" as const },
    missing: { label: t("adminClients.insuranceMissing"), tone: "danger" as const },
  }[status];
  return (
    <Section title={t("adminClients.insurance")} right={<Badge label={badge.label} tone={badge.tone} />}>
      <InfoLine label={t("adminClients.insuranceCompany")} value={profile.insurance_company} />
      <InfoLine label={t("adminClients.insurancePolicy")} value={profile.insurance_policy} />
      <InfoLine
        label={t("adminClients.insuranceValidUntil")}
        value={profile.insurance_valid_until ? formatDate(dayDate(profile.insurance_valid_until)) : null}
      />
      {profile.insurance_proof_path ? (
        <Button
          label={t("adminClients.proof")}
          variant="secondary"
          onPress={() => openProof(profile.insurance_proof_path!)}
        />
      ) : null}
    </Section>
  );
}

function RoleSection({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
  const setRole = useSetUserRole();
  const isAdmin = profile.role === "admin";
  const next: UserRole = isAdmin ? "client" : "admin";

  const change = async () => {
    const ok = await confirm({
      title: t("adminClients.roleTitle"),
      message: isAdmin ? t("adminClients.makeClientMessage") : t("adminClients.makeAdminMessage"),
      confirmLabel: t("adminClients.roleConfirm"),
      destructive: isAdmin,
    });
    if (!ok) return;
    setRole.mutate(
      { userId: profile.id, role: next },
      { onError: (err) => notify(t("adminClients.roleFailed"), toUserMessage(err)) },
    );
  };

  return (
    <Section title={t("adminClients.role")}>
      <AppText variant="body">
        {t("adminClients.roleCurrent", {
          role: isAdmin ? t("adminClients.roleAdmin") : t("adminClients.roleClient"),
        })}
      </AppText>
      <Button
        label={isAdmin ? t("adminClients.makeClient") : t("adminClients.makeAdmin")}
        variant="secondary"
        loading={setRole.isPending}
        onPress={() => void change()}
      />
    </Section>
  );
}

const KINDS: Record<IncidentKind, TranslationKey> = {
  injury: "adminClients.kindInjury",
  bite: "adminClients.kindBite",
  fight: "adminClients.kindFight",
  dirt: "adminClients.kindDirt",
  rules_breach: "adminClients.kindRulesBreach",
  other: "adminClients.kindOther",
};

function Incidents({ incidents }: { incidents: ClientDetails["incidents"] }) {
  const { t } = useLanguage();
  const shown = incidents.slice(0, 10);
  return (
    <Section title={t("adminClients.incidents")}>
      {incidents.length === 0 ? <AppText variant="body">{t("adminClients.noIncidents")}</AppText> : null}
      {shown.map((incident, index) => {
        const when = formatDateTime(incident.occurred_at);
        return (
          <Pressable
            key={incident.id}
            accessibilityRole="button"
            accessibilityLabel={t("adminClients.openIncident", { kind: t(KINDS[incident.kind]), date: when })}
            onPress={() => router.push({ pathname: "/admin/incident/[id]", params: { id: incident.id } })}
            style={({ pressed }) => [
              styles.line,
              styles.linkRow,
              index === shown.length - 1 && styles.lastLine,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.flex}>
              <View style={styles.wrapRow}>
                <Badge label={t(KINDS[incident.kind])} tone={incident.kind === "bite" ? "danger" : "warning"} />
                <AppText variant="caption">{when}</AppText>
              </View>
              <AppText variant="body" numberOfLines={3}>
                {incident.description}
              </AppText>
            </View>
            <AppText style={styles.chevron}>›</AppText>
          </Pressable>
        );
      })}
    </Section>
  );
}

function bookingDate(period: unknown) {
  if (typeof period !== "string") return null;
  try {
    const { start } = parseRange(period);
    return formatDateTime(start);
  } catch {
    return null;
  }
}

function Bookings({ bookings }: { bookings: ClientDetails["bookings"] }) {
  const { t } = useLanguage();
  return (
    <Section title={t("adminClients.bookings")}>
      {bookings.length === 0 ? <AppText variant="body">{t("adminClients.noBookings")}</AppText> : null}
      {bookings.slice(0, 15).map((booking, index, shown) => (
        <Pressable
          key={booking.id}
          accessibilityRole="button"
          accessibilityLabel={booking.appointment?.service?.name ?? t("admin.bookingAdminTitle")}
          onPress={() => router.push({ pathname: "/admin/booking/[id]", params: { id: booking.id } })}
          style={({ pressed }) => [
            styles.line,
            index === shown.length - 1 && styles.lastLine,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.wrapRow}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {booking.appointment?.service?.name ?? "—"}
            </AppText>
            <Badge
              label={
                booking.status === "cancelled" ? t("adminClients.bookingCancelled") : t("adminClients.bookingConfirmed")
              }
              tone={booking.status === "cancelled" ? "neutral" : "success"}
            />
          </View>
          <AppText variant="caption">
            {bookingDate(booking.appointment?.period) ?? formatDate(booking.created_at)}
          </AppText>
        </Pressable>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.ink },
  email: { flexDirection: "row", flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: space.sm },
  actionsStacked: { flexDirection: "column" },
  action: { flexGrow: 1, flexBasis: 0, paddingHorizontal: space.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  flex: { flexShrink: 1, flexGrow: 1 },
  line: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  lastLine: { borderBottomWidth: 0 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chevron: { fontSize: 24, color: colors.inkSoft },
  pressed: { opacity: 0.7 },
});
