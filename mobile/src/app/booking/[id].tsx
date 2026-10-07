import * as Clipboard from "expo-clipboard";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type Booking, canCancel, canReschedule, useBooking, useCancelBooking } from "@/api/bookings";
import { useBookingExtras, useSetBookingGuests } from "@/api/park-profile";
import { useService } from "@/api/services";
import { useBookingGroup, useQuestionnaireResponse, useQuestions } from "@/api/v11-client";
import { Badge } from "@/components/badge";
import { bookingBadge } from "@/components/booking-card";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmergencyButton } from "@/components/emergency-button";
import { type GuestDraft, GuestsEditor, guestsValid, toGuestDrafts, toGuestInputs } from "@/components/guests-editor";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { describeDog } from "@/components/v11/dog-fields";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";
import { appLink } from "@/lib/links";
import { confirm, notify } from "@/lib/confirm";
import { colors, radius, space } from "@/theme";
import { formatDate, formatDayLong, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

export default function BookingRoute() {
  const { t, tp } = useLanguage();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const booking = useBooking(id);
  const cancel = useCancelBooking();

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
  const data = booking.data;
  if (!data) {
    return (
      <Screen underHeader>
        <EmptyView
          title={t("booking.notFound")}
          actionLabel={t("tabs.bookings")}
          onAction={() => router.navigate("/bookings")}
        />
      </Screen>
    );
  }

  const badge = bookingBadge(data);
  const cancellable = canCancel(data);
  const price = formatPrice(data.price_cents);

  const onCancel = async () => {
    const ok = await confirm({
      title: t("booking.cancelTitle"),
      message: t("booking.cancelMessage", {
        name: data.service.name,
        day: formatDayLong(data.start),
        time: formatTime(data.start),
      }),
      confirmLabel: t("booking.cancelButton"),
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(data.id, {
      onSuccess: () => void booking.refetch(),
      onError: (error) => notify(t("booking.cancelFailed"), toUserMessage(error)),
    });
  };

  return (
    <Screen underHeader>
      {created === "1" && data.status === "confirmed" ? (
        <View style={styles.success} accessibilityRole="alert">
          <AppText variant="heading" style={styles.successText}>
            {t("booking.created")}
          </AppText>
          <AppText variant="body" style={styles.successText}>
            {t("booking.createdText")}
          </AppText>
        </View>
      ) : null}

      <Card>
        <Badge label={badge.label} tone={badge.tone} />
        <AppText variant="title">{data.service.name}</AppText>
        <AppText variant="bodyStrong">{formatDayLong(data.start)}</AppText>
        <AppText variant="body">
          {formatTime(data.start)} –⁠ {formatTime(data.end)}
        </AppText>
        {data.visit_address ? <AppText variant="body">{data.visit_address}</AppText> : null}
        {!data.visit_address && data.service.location ? (
          <AppText variant="body">{data.service.location}</AppText>
        ) : null}
        {/* Un seul chien : « Avec Nami ». Plusieurs (parc) : ils sont listés dans la carte Chiens. */}
        {data.dog && (data.dogs_count ?? 0) <= 1 ? (
          <AppText variant="body">{t("common.with", { name: data.dog.name })}</AppText>
        ) : null}
        {data.children_count != null || data.dogs_count != null ? (
          <AppText variant="caption">
            {[
              data.adults_count != null ? tp("booking.peopleAdults", data.adults_count) : null,
              tp("booking.peopleChildren", data.children_count ?? 0),
              tp("booking.peopleDogs", data.dogs_count ?? 0),
            ]
              .filter(Boolean)
              .join(", ")}
          </AppText>
        ) : null}
        {price ? <AppText variant="bodyStrong">{t("booking.priceLine", { price })}</AppText> : null}
        {data.client_notes ? (
          <View style={styles.notes}>
            <AppText variant="caption">{t("booking.notesLabel")}</AppText>
            <AppText variant="body">{t("booking.notesQuoted", { text: data.client_notes })}</AppText>
          </View>
        ) : null}
      </Card>

      <EmergencyButton booking={data} />

      <BookingExtras booking={data} />

      <QuestionnaireCard booking={data} />

      {data.status === "confirmed" ? (
        cancellable ? (
          <View style={styles.actions}>
            {canReschedule(data) ? (
              <Button
                label={t("booking.reschedule")}
                onPress={() =>
                  router.push({
                    pathname: "/service/[slug]",
                    params: { slug: data.service.slug, reschedule: data.id },
                  })
                }
              />
            ) : null}
            <Button
              label={t("booking.cancelButton")}
              variant="dangerText"
              loading={cancel.isPending}
              onPress={() => void onCancel()}
              style={styles.cancel}
            />
            <AppText variant="caption">
              {t("booking.cancelPolicy", { hours: data.service.cancel_notice_hours })}
            </AppText>
          </View>
        ) : data.start > new Date() ? (
          <View style={styles.actions}>
            <AppText variant="caption">{t("booking.tooLate", { hours: data.service.cancel_notice_hours })}</AppText>
            <Button
              label={t("booking.contactUs")}
              variant="secondary"
              onPress={() =>
                void openContactEmail(
                  `${data.service.name} · ${formatDayLong(data.start)} ${formatTime(data.start)}`,
                ).catch(() => undefined)
              }
            />
          </View>
        ) : null
      ) : null}
    </Screen>
  );
}

/** Chiens et invités de la réservation ; invités modifiables tant qu’elle est confirmée et à venir. */
function BookingExtras({ booking }: { booking: Booking }) {
  const { t } = useLanguage();
  const extras = useBookingExtras(booking.id);
  const service = useService(booking.service.slug);
  const group = useBookingGroup(booking.id);
  const save = useSetBookingGuests();
  const [drafts, setDrafts] = useState<GuestDraft[] | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (extras.isLoading) return <LoadingView />;
  if (extras.isError) return <ErrorView error={extras.error} onRetry={() => void extras.refetch()} />;
  const dogs = extras.data?.dogs ?? [];
  const guests = extras.data?.guests ?? [];
  const groupDogs = group.data?.dogs ?? [];
  const parkLike = Boolean(service.data?.requires_park_profile);
  const editable = booking.status === "confirmed" && booking.start > new Date() && (parkLike || guests.length > 0);
  if (dogs.length === 0 && guests.length === 0 && groupDogs.length === 0 && !editable) return null;
  // Lien live personnel : seulement pour le parc, tant que la réservation n’est pas passée.
  const showLinks = parkLike && booking.status === "confirmed" && booking.end > new Date();

  const onCopy = async (guestId: string, token: string) => {
    try {
      await Clipboard.setStringAsync(appLink(`live/${token}`));
      setCopied(guestId);
    } catch (err) {
      notify(t("parkBooking.guestLinkCopy"), toUserMessage(err));
    }
  };

  const onSave = () => {
    if (!drafts) return;
    setShowErrors(true);
    if (!guestsValid(drafts)) return setError(t("parkBooking.guestNamesRequired"));
    setError(null);
    save.mutate(
      { bookingId: booking.id, guests: toGuestInputs(drafts) },
      {
        onSuccess: () => {
          setDrafts(null);
          setShowErrors(false);
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <>
      {dogs.length > 0 ? (
        <Card>
          <AppText variant="heading">{t("parkBooking.extrasDogs")}</AppText>
          {dogs.map((dog) => (
            <AppText key={dog.id} variant="body">
              {dog.breed ? `${dog.name} · ${dog.breed}` : dog.name}
            </AppText>
          ))}
        </Card>
      ) : null}

      {groupDogs.length > 0 ? (
        <Card>
          <AppText variant="heading">{t("v11Client.groupTitle")}</AppText>
          {groupDogs.map((dog, index) => (
            <View key={`${dog.name}-${index}`} style={styles.groupDog}>
              <AppText variant="body">{describeDog(dog, t)}</AppText>
              {dog.protocol ? <Badge label={t("v11Client.dogProtocol")} tone="warning" /> : null}
            </View>
          ))}
          {group.data?.certifiedAt ? <AppText variant="caption">{t("v11Client.groupCertified")}</AppText> : null}
        </Card>
      ) : null}

      {drafts ? (
        <View style={styles.actions}>
          <GuestsEditor value={drafts} onChange={setDrafts} showErrors={showErrors} />
          {error ? (
            <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button label={t("parkBooking.guestsSave")} loading={save.isPending} onPress={onSave} />
          <Button
            label={t("parkBooking.guestsCancel")}
            variant="ghost"
            onPress={() => {
              setDrafts(null);
              setError(null);
              setShowErrors(false);
            }}
          />
        </View>
      ) : guests.length > 0 || editable ? (
        <Card>
          <AppText variant="heading">{t("parkBooking.extrasGuests")}</AppText>
          {guests.length === 0 ? <AppText variant="caption">{t("parkBooking.guestsEmpty")}</AppText> : null}
          {guests.map((guest) => (
            <View key={guest.id} style={styles.guest}>
              <AppText variant="bodyStrong">{guest.full_name}</AppText>
              {parkLike && booking.status === "confirmed" ? (
                <Badge
                  label={
                    guest.profile_completed_at ? t("v11Client.guestProfileDone") : t("v11Client.guestProfilePending")
                  }
                  tone={guest.profile_completed_at ? "success" : "warning"}
                />
              ) : null}
              {/* E-mail et téléphone sur deux lignes ; le numéro ne se coupe jamais. */}
              {guest.email ? <AppText variant="caption">{guest.email}</AppText> : null}
              {guest.phone ? <AppText variant="caption">{guest.phone.replace(/ /g, "\u00a0")}</AppText> : null}
              {showLinks ? (
                guest.email ? (
                  <AppText variant="caption">{t("parkBooking.guestLinkEmail")}</AppText>
                ) : (
                  <>
                    <AppText variant="caption">{t("parkBooking.guestLinkNoEmail")}</AppText>
                    <Button
                      label={copied === guest.id ? t("parkBooking.guestLinkCopied") : t("parkBooking.guestLinkCopy")}
                      accessibilityLabel={`${t("parkBooking.guestLinkCopy")} · ${guest.full_name}`}
                      variant="secondary"
                      onPress={() => void onCopy(guest.id, guest.access_token)}
                    />
                  </>
                )
              ) : null}
            </View>
          ))}
          {showLinks && guests.length > 0 ? (
            <AppText variant="caption">{t("parkBooking.guestLinkPersonal")}</AppText>
          ) : null}
          {editable ? (
            <>
              <AppText variant="caption">{t("parkBooking.guestsResponsibility")}</AppText>
              <Button
                label={t("parkBooking.guestsEdit")}
                variant="secondary"
                onPress={() => setDrafts(toGuestDrafts(guests))}
              />
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

/** Questionnaire pré-visite (M1-05) : état et accès, si la prestation en a un. */
function QuestionnaireCard({ booking }: { booking: Booking }) {
  const { t } = useLanguage();
  const questions = useQuestions(booking.service.id);
  const response = useQuestionnaireResponse(booking.id);

  if (questions.isLoading || response.isLoading) return null;
  if (questions.isError || response.isError) {
    return (
      <ErrorView
        error={questions.error ?? response.error}
        onRetry={() => void Promise.all([questions.refetch(), response.refetch()])}
      />
    );
  }
  if (!questions.data?.length) return null;
  const sent = response.data;
  const editable = booking.status === "confirmed" && booking.start > new Date();
  // Réservation annulée sans réponse : rien à montrer.
  if (!editable && !sent && booking.status !== "confirmed") return null;
  // Route ajoutée en v1.1 : le cast évite de dépendre des types de routes générés par le serveur de dev.
  const open = () => router.push(`/booking/${booking.id}/questionnaire` as Href);

  return (
    <Card>
      <AppText variant="heading">{t("v11Client.cardTitle")}</AppText>
      <Badge
        label={
          sent
            ? t("v11Client.cardSent", { date: formatDate(sent.updatedAt) })
            : editable
              ? t("v11Client.cardTodo")
              : t("v11Client.cardNotSent")
        }
        tone={sent ? "success" : editable ? "warning" : "neutral"}
      />
      {editable ? (
        <Button
          label={sent ? t("v11Client.cardEdit") : t("v11Client.cardFill")}
          variant={sent ? "secondary" : "primary"}
          onPress={open}
        />
      ) : sent ? (
        <Button label={t("v11Client.cardView")} variant="secondary" onPress={open} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Chaque invité dans son encadré : deux invités ne se confondent pas.
  guest: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  groupDog: { gap: space.xs, alignItems: "flex-start" },
  notes: { gap: 2 },
  cancel: { borderWidth: 1, borderColor: colors.danger },
  error: { color: colors.danger },
  success: { backgroundColor: colors.freeSoft, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  successText: { color: colors.free },
  actions: { gap: space.md },
});
