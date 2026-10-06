export const queryKeys = {
  services: ["services"] as const,
  slots: (serviceId: string, from: string, to: string) => ["slots", serviceId, from, to] as const,
  allSlots: ["slots"] as const,
  myBookings: (userId: string | null) => ["bookings", "mine", userId] as const,
  booking: (id: string) => ["bookings", "detail", id] as const,
  allBookings: ["bookings"] as const,
  dogs: (userId: string | null) => ["dogs", userId] as const,
  profile: (userId: string | null) => ["profile", userId] as const,
  parkStatus: ["park", "status"] as const,
  liveStream: (userId: string | null) => ["park", "live", userId] as const,
  agenda: (from: string, to: string) => ["agenda", from, to] as const,
  allAgenda: ["agenda"] as const,
};
