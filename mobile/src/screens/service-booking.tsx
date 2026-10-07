import { router, Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { type ScrollView, StyleSheet, View } from "react-native";

import { useBookEvent, useBookSlot, useRescheduleBooking } from "@/api/bookings";
import { checkDiscountCode, useRequiredDocuments } from "@/api/documents";
import { useDogs } from "@/api/dogs";
import { useFullDays, useQuote } from "@/api/pricing";
import { PARK_SERVICE_SLUG, type Service } from "@/api/services";
import { type Slot, useSlots } from "@/api/slots";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { DayPicker } from "@/components/day-picker";
import { Screen } from "@/components/screen";
import { SlotGrid } from "@/components/slot-grid";
import { type GuestDraft, GuestsEditor, guestsValid, toGuestInputs } from "@/components/guests-editor";
import { ParkReadiness } from "@/components/park-readiness";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { Stepper } from "@/components/stepper";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { WaitlistButton, WaitlistEntries } from "@/components/waitlist-button";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { addDays, dayParts, formatDayLong, formatTime, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

/** Fenêtre affichée dans le sélecteur (bornée côté serveur par max_advance_days). */
const WINDOW_DAYS = 30;

type DiscountState = { code: string; valid: boolean } | null;

export function ServiceBooking({ service, rescheduleBookingId }: { service: Service; rescheduleBookingId?: string }) {
  const { t, tp } = useLanguage();
  const { userId } = useAuth();
  const rescheduling = Boolean(rescheduleBookingId);
  const isPark = service.slug === PARK_SERVICE_SLUG;
  // Parc (ou toute prestation soumise aux mêmes conditions) : plusieurs chiens, invités, fiche complète.
  const parkProfile = service.requires_park_profile;
  const showAdults = isPark || parkProfile;
  const maxDogs = service.max_dogs ?? 20;
  const maxPeople = service.max_people;
  const today = toIsoDay(new Date());
  const lastDay = addDays(today, Math.min(service.max_advance_days, WINDOW_DAYS));
  const slots = useSlots(service.id, today, lastDay);
  // Jours complets : sélectionnables pour la liste d’attente (pas pendant un report).
  const fullDaysQuery = useFullDays(service.id, today, lastDay, !rescheduling);
  const dogs = useDogs();
  const documents = useRequiredDocuments(rescheduling ? undefined : service.id);

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [dogId, setDogId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [dogsCount, setDogsCount] = useState(1);
  const [dogIds, setDogIds] = useState<string[]>([]);
  const [guests, setGuests] = useState<GuestDraft[]>([]);
  const [showGuestErrors, setShowGuestErrors] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [discount, setDiscount] = useState<DiscountState>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [openDocument, setOpenDocument] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const bookSlot = useBookSlot();
  const bookEvent = useBookEvent();
  const reschedule = useRescheduleBooking();
  const submitting = bookSlot.isPending || bookEvent.isPending || reschedule.isPending;

  const selectSlot = (slot: Slot | null) => {
    setSelected(slot);
    // Amène la suite du formulaire à l’écran.
    if (slot && userId) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const { days, byDay } = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const slot of slots.data ?? []) (groups[toIsoDay(slot.startsAt)] ??= []).push(slot);
    const allDays: string[] = [];
    for (let day = today; day <= lastDay; day = addDays(day, 1)) allDays.push(day);
    return { days: allDays, byDay: groups };
  }, [slots.data, today, lastDay]);

  const counts = Object.fromEntries(days.map((day) => [day, byDay[day]?.length ?? 0]));
  const fullDays = useMemo(() => (rescheduling ? [] : (fullDaysQuery.data ?? [])), [rescheduling, fullDaysQuery.data]);
  const activeDay = pickedDay ?? days.find((day) => (counts[day] ?? 0) > 0) ?? null;
  const activeDayFull = activeDay != null && (counts[activeDay] ?? 0) === 0 && fullDays.includes(activeDay);
  const daySlots = activeDay ? (byDay[activeDay] ?? []) : [];
  const pendingDocuments = (documents.data ?? []).filter((document) => !document.accepted);
  const documentsOk = pendingDocuments.every((document) => accepted[document.documentId]);
  const addressOk = !service.requires_address || address.trim().length > 0;

  // Plafond de personnes (adultes + enfants) quand l’administratrice l’a renseigné.
  const adultsMax = maxPeople ? Math.max(1, maxPeople - children) : 20;
  const childrenMax = maxPeople ? Math.max(0, maxPeople - (showAdults ? adults : 1)) : 20;

  const guestInputs = useMemo(() => (parkProfile ? toGuestInputs(guests) : []), [parkProfile, guests]);

  const toggleDog = (id: string) =>
    setDogIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length >= maxDogs ? prev : [...prev, id],
    );

  const onCheckCode = async () => {
    const code = codeInput.trim();
    if (!code) return setDiscount(null);
    try {
      const result = await checkDiscountCode(service.id, code);
      setDiscount({ code, valid: result.valid });
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const onConfirm = () => {
    if (!selected) return;
    setError(null);
    const onError = (err: unknown) => {
      setError(toUserMessage(err));
      selectSlot(null);
    };

    if (rescheduleBookingId) {
      reschedule.mutate(
        { bookingId: rescheduleBookingId, startsAt: selected.startsAt },
        {
          onSuccess: () => {
            notify(t("booking.rescheduled"), "");
            router.replace({ pathname: "/booking/[id]", params: { id: rescheduleBookingId } });
          },
          onError,
        },
      );
      return;
    }

    if (!addressOk) return setError(t("errors.address_required"));
    if (!documentsOk) return setError(t("booking.documentsRequired"));
    if (parkProfile && dogIds.length === 0) return setError(t("parkBooking.dogRequired"));
    if (parkProfile && !guestsValid(guests)) {
      setShowGuestErrors(true);
      return setError(t("parkBooking.guestNamesRequired"));
    }

    const details = {
      dogId: parkProfile ? null : dogId,
      dogIds: parkProfile ? dogIds : undefined,
      notes,
      visitAddress: service.requires_address ? address : undefined,
      adultsCount: showAdults ? adults : undefined,
      childrenCount: children,
      dogsCount: parkProfile ? dogIds.length : dogsCount,
      discountCode: discount?.valid ? discount.code : undefined,
      documentIds: pendingDocuments.map((document) => document.documentId),
      guests: guestInputs,
    };
    const onSuccess = (bookingId: string) =>
      router.replace({ pathname: "/booking/[id]", params: { id: bookingId, created: "1" } });

    if (service.mode === "event") {
      if (!selected.appointmentId) return;
      bookEvent.mutate({ ...details, appointmentId: selected.appointmentId }, { onSuccess, onError });
    } else {
      bookSlot.mutate({ ...details, serviceId: service.id, startsAt: selected.startsAt }, { onSuccess, onError });
    }
  };

  const confirmLabel = selected
    ? t(rescheduling ? "booking.rescheduleConfirm" : "booking.confirm", {
        day: dayParts(toIsoDay(selected.startsAt)).weekday,
        time: formatTime(selected.startsAt),
      })
    : t("booking.chooseSlot");

  const footer = !userId ? (
    <Button label={t("booking.signInToBook")} onPress={() => router.push("/sign-in")} />
  ) : (
    <Button label={confirmLabel} disabled={!selected} loading={submitting} onPress={onConfirm} />
  );

  const quote = useQuote({
    serviceId: service.id,
    startsAt: userId && selected && !rescheduling ? selected.startsAt : null,
    dogs: parkProfile ? Math.max(1, dogIds.length) : dogsCount,
    guests: guestInputs.length,
    discountCode: discount?.valid ? discount.code : undefined,
  });
  const quotedPrice = formatPrice(quote.data?.price_cents ?? null);
  const quotedDiscount = quote.data?.discount_cents ? formatPrice(quote.data.discount_cents) : null;
  const hasSlots = (slots.data?.length ?? 0) > 0 || fullDays.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: rescheduling ? t("booking.rescheduleTitle") : "" }} />
      <Screen
        underHeader
        heading={service.name}
        scrollRef={scrollRef}
        footer={footer}
        refreshing={slots.isRefetching}
        onRefresh={() => void slots.refetch()}
      >
        {!rescheduling ? (
          <View style={styles.intro}>
            {(service.description || service.summary).split(/\n{2,}/).map((text) => (
              <AppText key={text} variant="body">
                {text}
              </AppText>
            ))}
            {formatPrice(service.displayPriceCents) ? (
              <AppText variant="bodyStrong">{formatPrice(service.displayPriceCents)}</AppText>
            ) : null}
          </View>
        ) : null}

        {userId && parkProfile && !rescheduling ? <ParkReadiness day={activeDay} /> : null}

        <AppText variant="heading">{t("booking.chooseDay")}</AppText>
        {slots.isLoading ? (
          <LoadingView label={t("booking.searching")} />
        ) : slots.isError ? (
          <ErrorView error={slots.error} onRetry={() => void slots.refetch()} />
        ) : !hasSlots ? (
          <EmptyView
            title={service.mode === "event" ? t("booking.noEvent") : t("booking.noSlot")}
            message={t("booking.noSlotText")}
          />
        ) : (
          <>
            <DayPicker
              days={days}
              selected={activeDay}
              counts={counts}
              fullDays={fullDays}
              onSelect={(day) => {
                setPickedDay(day);
                selectSlot(null);
              }}
            />
            {activeDay ? <AppText variant="heading">{formatDayLong(`${activeDay}T12:00:00Z`)}</AppText> : null}
            {activeDayFull && activeDay ? (
              <Card>
                <AppText variant="bodyStrong">{t("parkBooking.dayFullTitle")}</AppText>
                <AppText variant="body">{t("parkBooking.waitlistIntro")}</AppText>
                {userId ? (
                  <WaitlistButton serviceId={service.id} day={activeDay} />
                ) : (
                  <AppText variant="caption">{t("parkBooking.waitlistSignIn")}</AppText>
                )}
              </Card>
            ) : (
              <SlotGrid
                wide={service.mode === "event"}
                items={daySlots.map((slot) => ({
                  key: slot.startsAt,
                  label:
                    service.mode === "event"
                      ? `${formatTime(slot.startsAt)} · ${tp("booking.places", slot.remaining)}`
                      : formatTime(slot.startsAt),
                  accessibilityLabel: t("booking.slotA11y", {
                    start: formatTime(slot.startsAt),
                    end: formatTime(slot.endsAt),
                  }),
                  selected: selected?.startsAt === slot.startsAt,
                  onPress: () => selectSlot(selected?.startsAt === slot.startsAt ? null : slot),
                }))}
              />
            )}
          </>
        )}

        {!slots.isLoading && !slots.isError && !rescheduling ? (
          <WaitlistEntries serviceId={service.id} exceptDay={activeDayFull ? activeDay : null} />
        ) : null}

        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}

        {userId && selected && !rescheduling ? (
          <View style={styles.details}>
            {service.requires_address ? (
              <TextField
                label={t("booking.address")}
                placeholder={t("booking.addressPlaceholder")}
                value={address}
                onChangeText={setAddress}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                maxLength={300}
              />
            ) : null}

            <Card>
              {showAdults ? (
                <Stepper label={t("booking.adults")} value={adults} onChange={setAdults} min={1} max={adultsMax} />
              ) : null}
              <Stepper label={t("booking.children")} value={children} onChange={setChildren} max={childrenMax} />
              {parkProfile ? null : (
                <Stepper label={t("booking.dogsCount")} value={dogsCount} onChange={setDogsCount} max={maxDogs} />
              )}
              {maxPeople ? (
                <AppText variant="caption">{t("parkBooking.maxPeople", { count: maxPeople })}</AppText>
              ) : null}
              {service.max_dogs ? (
                <AppText variant="caption">{t("booking.maxDogs", { count: service.max_dogs })}</AppText>
              ) : null}
            </Card>

            {parkProfile ? (
              <Card>
                <AppText variant="heading">{t("parkBooking.dogsTitle")}</AppText>
                <AppText variant="caption">
                  {service.max_dogs
                    ? t("parkBooking.dogsHint", { max: service.max_dogs })
                    : t("parkBooking.dogsHintNoMax")}
                </AppText>
                <View style={styles.chips}>
                  {dogs.data?.map((dog) => {
                    const checked = dogIds.includes(dog.id);
                    return (
                      <Chip
                        key={dog.id}
                        label={checked ? `✓ ${dog.name}` : dog.name}
                        accessibilityLabel={dog.name}
                        selected={checked}
                        disabled={!checked && dogIds.length >= maxDogs}
                        onPress={() => toggleDog(dog.id)}
                      />
                    );
                  })}
                  <Chip
                    label={t("booking.addDog")}
                    selected={false}
                    onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: "new" } })}
                  />
                </View>
                <AppText variant="bodyStrong">{tp("parkBooking.dogsSelected", dogIds.length)}</AppText>
              </Card>
            ) : (
              <>
                <AppText variant="heading">{t("booking.whichDog")}</AppText>
                <View style={styles.chips}>
                  <Chip label={t("booking.dogUnspecified")} selected={dogId === null} onPress={() => setDogId(null)} />
                  {dogs.data?.map((dog) => (
                    <Chip key={dog.id} label={dog.name} selected={dogId === dog.id} onPress={() => setDogId(dog.id)} />
                  ))}
                  <Chip
                    label={t("booking.addDog")}
                    selected={false}
                    onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: "new" } })}
                  />
                </View>
              </>
            )}

            {parkProfile ? <GuestsEditor value={guests} onChange={setGuests} showErrors={showGuestErrors} /> : null}

            <TextField
              label={t("booking.notes")}
              placeholder={t("booking.notesPlaceholder")}
              value={notes}
              onChangeText={setNotes}
              maxLength={1000}
              multiline
            />

            <View style={styles.codeRow}>
              <View style={styles.codeField}>
                <TextField
                  label={t("booking.discount")}
                  value={codeInput}
                  onChangeText={(text) => {
                    setCodeInput(text.toUpperCase());
                    setDiscount(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={32}
                  onSubmitEditing={() => void onCheckCode()}
                />
              </View>
              <Button label="OK" variant="secondary" onPress={() => void onCheckCode()} style={styles.codeButton} />
            </View>
            {discount ? (
              <AppText variant="caption" style={discount.valid ? styles.ok : styles.error}>
                {discount.valid ? t("booking.discountAppliedNoPrice") : t("booking.discountInvalid")}
              </AppText>
            ) : null}

            {pendingDocuments.length > 0 ? (
              <Card>
                <AppText variant="heading">{t("booking.documentsTitle")}</AppText>
                {pendingDocuments.map((document) => (
                  <View key={document.documentId} style={styles.document}>
                    <Checkbox
                      label={t("booking.documentAccept", { title: document.title, version: document.version })}
                      checked={Boolean(accepted[document.documentId])}
                      onChange={(checked) => setAccepted((prev) => ({ ...prev, [document.documentId]: checked }))}
                    />
                    <Button
                      label={t("booking.documentRead")}
                      variant="ghost"
                      onPress={() => setOpenDocument(openDocument === document.documentId ? null : document.documentId)}
                    />
                    {openDocument === document.documentId ? (
                      <AppText variant="caption" style={styles.documentBody}>
                        {document.body}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : null}

            {quote.isLoading ? (
              <AppText variant="caption">{t("parkBooking.priceLoading")}</AppText>
            ) : quotedPrice ? (
              <View style={styles.price} accessibilityLiveRegion="polite">
                <AppText variant="bodyStrong">{t("booking.priceLine", { price: quotedPrice })}</AppText>
                {quote.data?.labels.length ? (
                  <AppText variant="caption">{quote.data.labels.join(" · ")}</AppText>
                ) : null}
                {quotedDiscount ? (
                  <AppText variant="caption" style={styles.ok}>
                    {t("parkBooking.priceDiscount", { amount: quotedDiscount })}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {service.cancel_notice_hours > 0 ? (
              <AppText variant="caption">{t("booking.cancelPolicy", { hours: service.cancel_notice_hours })}</AppText>
            ) : null}
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  details: { gap: space.md },
  codeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  codeField: { flex: 1 },
  codeButton: { minWidth: 64 },
  document: { gap: space.xs },
  price: { gap: 2 },
  documentBody: { padding: space.sm, backgroundColor: colors.cream, borderRadius: 8 },
  error: { color: colors.danger },
  ok: { color: colors.free },
});
