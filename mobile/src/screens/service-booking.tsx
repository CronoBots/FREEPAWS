import { router, Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { type ScrollView, StyleSheet, View } from "react-native";

import { useBookEvent, useBookSlot, useRescheduleBooking } from "@/api/bookings";
import { checkDiscountCode, useRequiredDocuments } from "@/api/documents";
import { useDogs } from "@/api/dogs";
import { useFullDays, useQuote } from "@/api/pricing";
import { PARK_SERVICE_SLUG, type Service } from "@/api/services";
import { type Slot, useSlots } from "@/api/slots";
import { useParkEligibility } from "@/api/v11-client";
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
import { type DogDraft, toGroupDog } from "@/components/v11/dog-fields";
import { EligibilityPreview } from "@/components/v11/eligibility-preview";
import { GroupDogsEditor, groupDogsValid } from "@/components/v11/group-dogs-editor";
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
  const [picked, setPicked] = useState<Slot | null>(null);
  // Jour où la personne a retiré la séance présélectionnée (on ne la remet pas).
  const [autoDismissedDay, setAutoDismissedDay] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  // Chiens non enregistrés sur le compte (hors parc) : s’ajoutent aux chiens touchés.
  const [extraDogs, setExtraDogs] = useState(0);
  const [dogIds, setDogIds] = useState<string[]>([]);
  const [guests, setGuests] = useState<GuestDraft[]>([]);
  const [showGuestErrors, setShowGuestErrors] = useState(false);
  const [groupDogs, setGroupDogs] = useState<DogDraft[]>([]);
  const [groupCertified, setGroupCertified] = useState(false);
  const [showGroupErrors, setShowGroupErrors] = useState(false);
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
    setPicked(slot);
    // Amène la suite du formulaire à l’écran.
    if (slot && userId) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const fullDays = useMemo(() => (rescheduling ? [] : (fullDaysQuery.data ?? [])), [rescheduling, fullDaysQuery.data]);
  const { days, byDay } = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const slot of slots.data ?? []) (groups[toIsoDay(slot.startsAt)] ??= []).push(slot);
    const allDays: string[] = [];
    for (let day = today; day <= lastDay; day = addDays(day, 1)) {
      // Séances (ateliers) : seulement les jours où une séance existe, pas une rangée de jours grisés.
      if (service.mode !== "event" || groups[day] || fullDays.includes(day)) allDays.push(day);
    }
    return { days: allDays, byDay: groups };
  }, [slots.data, today, lastDay, service.mode, fullDays]);

  const counts = Object.fromEntries(days.map((day) => [day, byDay[day]?.length ?? 0]));
  const activeDay = pickedDay ?? days.find((day) => (counts[day] ?? 0) > 0) ?? null;
  const activeDayFull = activeDay != null && (counts[activeDay] ?? 0) === 0 && fullDays.includes(activeDay);
  const daySlots = activeDay ? (byDay[activeDay] ?? []) : [];

  // Séance (atelier) : quand le jour n’en propose qu’une, elle est présélectionnée.
  const autoSlot =
    service.mode === "event" && daySlots.length === 1 && autoDismissedDay !== activeDay ? daySlots[0] : null;
  const selected = picked ?? autoSlot ?? null;
  const pendingDocuments = (documents.data ?? []).filter((document) => !document.accepted);
  const documentsOk = pendingDocuments.every((document) => accepted[document.documentId]);
  const addressOk = !service.requires_address || address.trim().length > 0;

  // Plafond de personnes (adultes + enfants) quand l’administratrice l’a renseigné.
  const adultsMax = maxPeople ? Math.max(1, maxPeople - children) : 20;
  const childrenMax = maxPeople ? Math.max(0, maxPeople - (showAdults ? adults : 1)) : 20;

  const guestInputs = useMemo(() => (parkProfile ? toGuestInputs(guests) : []), [parkProfile, guests]);

  // Parc : chiens du compte + chiens d’autres foyers, sous le même plafond (M2-06).
  const groupCount = parkProfile ? groupDogs.length : 0;
  // Autres prestations : chiens touchés + compteur des chiens non enregistrés.
  const otherCount = parkProfile ? groupCount : extraDogs;
  const totalDogs = dogIds.length + otherCount;
  const effectiveDogsCount = totalDogs;
  const dogsFull = totalDogs >= maxDogs;

  const toggleDog = (id: string) =>
    setDogIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length + otherCount >= maxDogs
          ? prev
          : [...prev, id],
    );

  // Aperçu des règles de santé dès qu’un créneau et des chiens sont choisis (M2-09).
  const eligibility = useParkEligibility({
    serviceId: service.id,
    startsAt: selected?.startsAt ?? null,
    dogIds,
    groupCount,
    enabled: Boolean(userId) && parkProfile && !rescheduling && totalDogs > 0,
  });
  const eligibilityBlocked = Boolean(eligibility.data?.error);

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
    // Coaching : un chien n’est pas obligatoire (ex. accompagnement avant adoption).
    if (parkProfile && totalDogs === 0) return setError(t("parkBooking.dogRequired"));
    if (parkProfile && groupDogs.length > 0 && (!groupDogsValid(groupDogs) || !groupCertified)) {
      setShowGroupErrors(true);
      return setError(
        groupDogsValid(groupDogs) ? t("v11Client.groupCertifyRequired") : t("v11Client.groupNamesRequired"),
      );
    }
    if (parkProfile && !guestsValid(guests)) {
      setShowGuestErrors(true);
      return setError(t("parkBooking.guestNamesRequired"));
    }

    const details = {
      dogId: null,
      dogIds,
      notes,
      visitAddress: service.requires_address ? address : undefined,
      adultsCount: showAdults ? adults : undefined,
      childrenCount: children,
      dogsCount: effectiveDogsCount,
      discountCode: discount?.valid ? discount.code : undefined,
      documentIds: pendingDocuments.map((document) => document.documentId),
      guests: guestInputs,
      groupDogs: parkProfile ? groupDogs.map(toGroupDog) : undefined,
      groupCertified: parkProfile && groupDogs.length > 0 ? groupCertified : undefined,
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

  const selectedDay = selected ? dayParts(toIsoDay(selected.startsAt)) : null;
  const confirmLabel = selected
    ? t(rescheduling ? "booking.rescheduleConfirm" : "booking.confirm", {
        day: `${selectedDay?.weekday} ${selectedDay?.day} ${selectedDay?.month}`,
        time: formatTime(selected.startsAt),
      })
    : t("booking.chooseSlot");

  // Ce qui manque encore avant de pouvoir confirmer (affiché au-dessus du prix).
  const missing =
    !selected || rescheduling
      ? null
      : !addressOk
        ? t("errors.address_required")
        : parkProfile && totalDogs === 0
          ? t("parkBooking.dogRequired")
          : null;

  const hasDogs = (dogs.data?.length ?? 0) > 0;
  const dogChips = (
    <>
      {hasDogs ? (
        <View style={styles.chips}>
          {dogs.data?.map((dog) => {
            const checked = dogIds.includes(dog.id);
            return (
              <Chip
                key={dog.id}
                label={checked ? `✓ ${dog.name}` : dog.name}
                accessibilityLabel={dog.name}
                selected={checked}
                disabled={!checked && dogsFull}
                onPress={() => toggleDog(dog.id)}
              />
            );
          })}
        </View>
      ) : null}
      {/* Même style que « + Ajouter un chien » : un bouton, distinct des pastilles de chiens. */}
      <Button
        label={t("booking.addDog")}
        variant="secondary"
        onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: "new" } })}
      />
    </>
  );

  const footer = !userId ? (
    <Button label={t("booking.signInToBook")} onPress={() => router.push("/sign-in")} />
  ) : (
    <Button
      label={confirmLabel}
      disabled={!selected || Boolean(missing) || (!rescheduling && eligibilityBlocked)}
      loading={submitting}
      onPress={onConfirm}
    />
  );

  const quote = useQuote({
    serviceId: service.id,
    startsAt: userId && selected && !rescheduling && totalDogs > 0 ? selected.startsAt : null,
    dogs: effectiveDogsCount,
    guests: guestInputs.length,
    discountCode: discount?.valid ? discount.code : undefined,
  });
  const quotedDiscount = quote.data?.discount_cents ? formatPrice(quote.data.discount_cents) : null;
  // Prix final affiché seulement s’il apporte une information (différent du tarif de base annoncé plus haut).
  const quoteDiffers =
    quote.data != null &&
    (quote.data.price_cents !== service.displayPriceCents || quote.data.labels.length > 0 || Boolean(quotedDiscount));
  const quotedPrice = quoteDiffers ? formatPrice(quote.data?.price_cents ?? null) : null;
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
              <AppText variant="bodyStrong">
                {t("booking.basePrice", { price: formatPrice(service.displayPriceCents) ?? "" })}
              </AppText>
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
                      ? `${formatTime(slot.startsAt)} · ${tp("booking.placesLeft", slot.remaining)}`
                      : formatTime(slot.startsAt),
                  accessibilityLabel: t("booking.slotA11y", {
                    start: formatTime(slot.startsAt),
                    end: formatTime(slot.endsAt),
                  }),
                  selected: selected?.startsAt === slot.startsAt,
                  onPress: () => {
                    if (selected?.startsAt !== slot.startsAt) return selectSlot(slot);
                    if (!picked) setAutoDismissedDay(activeDay);
                    selectSlot(null);
                  },
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
                <>
                  <AppText variant="heading">{t("booking.peopleTitle")}</AppText>
                  <Stepper label={t("booking.adults")} value={adults} onChange={setAdults} min={1} max={adultsMax} />
                </>
              ) : null}
              <Stepper label={t("booking.children")} value={children} onChange={setChildren} max={childrenMax} />
              {maxPeople ? (
                <AppText variant="caption">{t("parkBooking.maxPeople", { count: maxPeople })}</AppText>
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
                {dogChips}
                {hasDogs ? (
                  <AppText variant="bodyStrong">{tp("parkBooking.dogsSelected", dogIds.length)}</AppText>
                ) : null}
              </Card>
            ) : (
              <Card>
                <AppText variant="heading">{t("booking.whichDogs")}</AppText>
                <AppText variant="caption">
                  {hasDogs ? t("booking.whichDogsHint") : t("booking.whichDogsHintNoDog")}
                </AppText>
                {dogChips}
                <Stepper
                  label={hasDogs ? t("booking.otherDogs") : t("booking.dogsShort")}
                  value={extraDogs}
                  onChange={setExtraDogs}
                  min={0}
                  max={Math.max(extraDogs, maxDogs - dogIds.length)}
                />
                <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
                  {tp("v11Client.dogsTotal", totalDogs)}
                </AppText>
                {service.max_dogs ? (
                  <AppText variant="caption">{t("booking.maxDogs", { count: service.max_dogs })}</AppText>
                ) : null}
              </Card>
            )}

            {parkProfile ? (
              <>
                <GroupDogsEditor
                  value={groupDogs}
                  onChange={setGroupDogs}
                  certified={groupCertified}
                  onCertifiedChange={setGroupCertified}
                  canAdd={!dogsFull}
                  showErrors={showGroupErrors}
                />
                {/* Total des deux cartes (chiens du compte + autres foyers), placé sous les deux. */}
                <View style={styles.total} accessibilityLiveRegion="polite">
                  <AppText variant="bodyStrong">{tp("v11Client.dogsTotal", totalDogs)}</AppText>
                  {dogsFull ? (
                    <AppText variant="caption">{t("v11Client.dogsMaxReached", { max: maxDogs })}</AppText>
                  ) : null}
                </View>
                <EligibilityPreview
                  loading={eligibility.isLoading && eligibility.fetchStatus !== "idle"}
                  data={totalDogs > 0 ? eligibility.data : undefined}
                />
                <GuestsEditor value={guests} onChange={setGuests} showErrors={showGuestErrors} />
              </>
            ) : null}

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
                  placeholder={t("booking.discountPlaceholder")}
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
              <Button
                label={t("booking.applyCode")}
                variant="secondary"
                onPress={() => void onCheckCode()}
                style={styles.codeButton}
              />
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

            {missing ? (
              <AppText variant="bodyStrong" style={styles.missing}>
                {missing}
              </AppText>
            ) : quote.isLoading ? (
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
  intro: { gap: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  details: { gap: space.md },
  codeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  codeField: { flex: 1 },
  codeButton: { minWidth: 64 },
  document: { gap: space.xs },
  price: { gap: 2 },
  total: { gap: 2 },
  documentBody: { padding: space.sm, backgroundColor: colors.cream, borderRadius: 8 },
  error: { color: colors.danger },
  missing: { color: colors.inkSoft },
  ok: { color: colors.free },
});
