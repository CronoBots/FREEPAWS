import { router, useLocalSearchParams } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { type AdminBooking, asGroupDog, type SnapshotQuestion, useAdminBooking } from "@/api/v11-admin";
import { CallRow } from "@/components/admin/safety/call-button";
import { answerText, dogText, healthWarningText } from "@/components/admin/v11/format";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { formatDate, formatDayLong, formatTime } from "@/utils/dates";
import { formatPrice } from "@/utils/format";

export default function AdminBookingRoute() {
  return (
    <AdminGuard>
      <BookingScreen />
    </AdminGuard>
  );
}

function BookingScreen() {
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useAdminBooking(id);

  if (booking.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (booking.isError) {
    return (
      <Screen underHeader>
        <ErrorView error={booking.error} onRetry={() => void booking.refetch()} />
      </Screen>
    );
  }
  if (!booking.data) {
    return (
      <Screen underHeader>
        <EmptyView title={t("v11Admin.bookingNotFound")} />
      </Screen>
    );
  }
  return (
    <BookingContent booking={booking.data} refreshing={booking.isRefetching} onRefresh={() => void booking.refetch()} />
  );
}

function Section({ title, right, children }: PropsWithChildren<{ title: string; right?: ReactNode }>) {
  return (
    <Card>
      <View style={styles.sectionHead}>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        {right}
      </View>
      {children}
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="body" style={styles.ink} selectable>
        {value}
      </AppText>
    </View>
  );
}

function BookingContent({
  booking,
  refreshing,
  onRefresh,
}: {
  booking: AdminBooking;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, tp } = useLanguage();
  const service = booking.appointment?.service;
  const cancelled = booking.status === "cancelled";

  return (
    <Screen
      underHeader
      heading={service?.name ?? t("admin.bookingAdminTitle")}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.summary}>
        {booking.start && booking.end ? (
          <AppText variant="bodyStrong">
            {`${formatDayLong(booking.start)} · ${formatTime(booking.start)} – ${formatTime(booking.end)}`}
          </AppText>
        ) : null}
        <View style={styles.badges}>
          <Badge
            label={cancelled ? t("v11Admin.statusCancelled") : t("v11Admin.statusConfirmed")}
            tone={cancelled ? "neutral" : "success"}
          />
          {booking.hasQuestionnaire ? (
            <Badge
              label={booking.response ? t("v11Admin.questionnaireReceived") : t("v11Admin.questionnairePending")}
              tone={booking.response ? "success" : "warning"}
            />
          ) : null}
          {booking.health_warnings.length > 0 ? (
            <Badge label={tp("v11Admin.badgeHealth", booking.health_warnings.length)} tone="danger" />
          ) : null}
        </View>
        <AppText variant="caption">
          {cancelled && booking.cancelled_at
            ? t("v11Admin.cancelledOn", { date: formatDate(booking.cancelled_at) })
            : t("v11Admin.bookedOn", { date: formatDate(booking.created_at) })}
        </AppText>
      </View>

      <ClientSection booking={booking} />
      <DetailsSection booking={booking} />
      {booking.health_warnings.length > 0 ? <HealthSection warnings={booking.health_warnings} /> : null}
      <DogsSection booking={booking} />
      {booking.guests.length > 0 ? <GuestsSection guests={booking.guests} /> : null}
      <QuestionnaireSection booking={booking} />
    </Screen>
  );
}

function ClientSection({ booking }: { booking: AdminBooking }) {
  const { t } = useLanguage();
  const client = booking.client;
  if (!client) return null;
  const name = client.full_name?.trim() || client.email;
  return (
    <Section title={t("v11Admin.sectionClient")}>
      <CallRow name={name} phone={client.phone} />
      <AppText variant="caption" selectable>
        {client.email}
      </AppText>
      <View style={styles.actions}>
        <Button
          label={t("v11Admin.openClient")}
          variant="secondary"
          style={styles.action}
          onPress={() => router.push({ pathname: "/admin/client/[id]", params: { id: client.id } })}
        />
        <Button
          label={t("v11Admin.write")}
          variant="secondary"
          style={styles.action}
          onPress={() => void Linking.openURL(`mailto:${client.email}`).catch(() => undefined)}
        />
      </View>
    </Section>
  );
}

function DetailsSection({ booking }: { booking: AdminBooking }) {
  const { t, tp } = useLanguage();
  const people = [
    booking.adults_count != null ? tp("v11Admin.adults", booking.adults_count) : null,
    booking.children_count ? tp("v11Admin.children", booking.children_count) : null,
    booking.dogs_count != null ? tp("v11Admin.dogs", booking.dogs_count) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const price = formatPrice(booking.price_cents);
  const discount = booking.discount_cents ? formatPrice(booking.discount_cents) : null;
  return (
    <Section title={t("v11Admin.sectionDetails")}>
      {booking.visit_address ? <Info label={t("v11Admin.address")} value={booking.visit_address} /> : null}
      <Info label={t("v11Admin.people")} value={people || t("v11Admin.notProvided")} />
      {booking.client_notes?.trim() ? (
        <Info label={t("v11Admin.message")} value={`« ${booking.client_notes.trim()} »`} />
      ) : null}
      <Info
        label={t("v11Admin.price")}
        value={[price ?? t("v11Admin.notProvided"), discount ? t("v11Admin.discount", { amount: discount }) : null]
          .filter(Boolean)
          .join(" · ")}
      />
    </Section>
  );
}

function HealthSection({ warnings }: { warnings: string[] }) {
  const { t } = useLanguage();
  return (
    <Card style={styles.danger}>
      <AppText variant="heading" accessibilityRole="header" style={styles.dangerText}>
        {t("v11Admin.sectionHealth")}
      </AppText>
      {warnings.map((warning) => (
        <AppText key={warning} variant="bodyStrong">
          • {healthWarningText(warning)}
        </AppText>
      ))}
      <AppText variant="caption">{t("v11Admin.healthHint")}</AppText>
    </Card>
  );
}

function DogLine({ dog }: { dog: { name: string; breed: string | null; size: string | null; protocol: boolean } }) {
  const { t } = useLanguage();
  return (
    <View style={[styles.dog, dog.protocol && styles.dogProtocol]}>
      <AppText variant="bodyStrong">{dogText(dog)}</AppText>
      {dog.protocol ? <Badge label={t("v11Admin.protocol")} tone="danger" /> : null}
    </View>
  );
}

function DogsSection({ booking }: { booking: AdminBooking }) {
  const { t } = useLanguage();
  return (
    <>
      <Section title={t("v11Admin.sectionOwnDogs")}>
        {booking.ownDogs.length === 0 ? <AppText variant="body">{t("v11Admin.noOwnDogs")}</AppText> : null}
        {booking.ownDogs.map((dog) => (
          <DogLine key={dog.id} dog={dog} />
        ))}
      </Section>
      {booking.groupDogs.length > 0 ? (
        <Section title={t("v11Admin.sectionGroupDogs")}>
          {booking.groupDogs.map((dog, index) => (
            <DogLine key={`${dog.name}-${index}`} dog={dog} />
          ))}
          <AppText variant="caption">
            {booking.group_certified_at
              ? t("v11Admin.groupCertified", { date: formatDate(booking.group_certified_at) })
              : t("v11Admin.groupNotCertified")}
          </AppText>
        </Section>
      ) : null}
    </>
  );
}

function GuestsSection({ guests }: { guests: AdminBooking["guests"] }) {
  const { t } = useLanguage();
  return (
    <Section title={t("v11Admin.sectionGuests")}>
      {guests.map((guest) => {
        const dog = asGroupDog(guest.dog);
        return (
          <View key={guest.id} style={styles.line}>
            <Badge
              label={guest.profile_completed_at ? t("v11Admin.guestCompleted") : t("v11Admin.guestPending")}
              tone={guest.profile_completed_at ? "success" : "warning"}
            />
            <CallRow name={guest.full_name} phone={guest.phone} />
            {guest.email ? (
              <AppText variant="caption" selectable>
                {guest.email}
              </AppText>
            ) : null}
            {guest.emergency_contact_name || guest.emergency_contact_phone ? (
              <CallRow
                caption={t("v11Admin.guestEmergency")}
                name={guest.emergency_contact_name || t("v11Admin.guestEmergency")}
                phone={guest.emergency_contact_phone}
              />
            ) : (
              <AppText variant="caption">{t("v11Admin.guestNoEmergency")}</AppText>
            )}
            {dog ? (
              <View style={styles.badges}>
                <AppText variant="body">{t("v11Admin.guestDog", { dog: dogText(dog) })}</AppText>
                {dog.protocol ? <Badge label={t("v11Admin.protocol")} tone="danger" /> : null}
              </View>
            ) : (
              <AppText variant="caption">{t("v11Admin.guestNoDog")}</AppText>
            )}
          </View>
        );
      })}
    </Section>
  );
}

function QuestionnaireSection({ booking }: { booking: AdminBooking }) {
  const { t } = useLanguage();
  const response = booking.response;
  const serviceId = booking.appointment?.service?.id;
  const questions = (
    Array.isArray(response?.questions_snapshot) ? response.questions_snapshot : []
  ) as SnapshotQuestion[];
  const answers = (response?.answers ?? {}) as Record<string, unknown>;
  const updated = response && response.updated_at.slice(0, 16) !== response.submitted_at.slice(0, 16);

  return (
    <Section
      title={t("v11Admin.sectionQuestionnaire")}
      right={
        booking.hasQuestionnaire ? (
          <Badge
            label={response ? t("v11Admin.questionnaireReceived") : t("v11Admin.questionnairePending")}
            tone={response ? "success" : "warning"}
          />
        ) : null
      }
    >
      {response ? (
        <>
          <AppText variant="caption">
            {t("v11Admin.submittedAt", {
              date: formatDate(response.submitted_at),
              time: formatTime(response.submitted_at),
            })}
            {updated
              ? ` · ${t("v11Admin.updatedAt", { date: formatDate(response.updated_at), time: formatTime(response.updated_at) })}`
              : ""}
          </AppText>
          {questions.map((question) => (
            <View key={question.id} style={styles.line}>
              <AppText variant="caption">{question.label}</AppText>
              <AppText variant="body" style={styles.ink} selectable>
                {answerText(question, answers[question.id])}
              </AppText>
            </View>
          ))}
        </>
      ) : (
        <AppText variant="body">
          {booking.hasQuestionnaire ? t("v11Admin.questionnaireNotReceived") : t("v11Admin.questionnaireNone")}
        </AppText>
      )}
      {serviceId ? (
        <Button
          label={t("v11Admin.editQuestionnaire")}
          variant="ghost"
          onPress={() => router.push({ pathname: "/admin/questionnaire/[serviceId]", params: { serviceId } })}
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.xs },
  sectionHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  flex: { flexShrink: 1, flexGrow: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs },
  info: { gap: 2 },
  ink: { color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1 },
  dangerText: { color: colors.danger },
  dog: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  dogProtocol: { borderColor: colors.danger, borderWidth: 1 },
  line: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
