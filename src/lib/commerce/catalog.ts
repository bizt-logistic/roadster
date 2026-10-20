// Product catalogue for the reservation demo. Shared by client and server;
// the server recomputes every amount from these values and never trusts
// prices sent by the browser.
//
// Reservation amounts are as shown in ABC News' coverage of the 15 Oct 2026
// reveal ("Performance … $50,000 to reserve", "Thrust … $250,000 to
// reserve"). Rocket was presented as invitation-only, so it takes an
// invitation request instead of a payment. Vehicle prices were not announced.

export type TrimId = "performance" | "thrust" | "rocket";

export type Trim = {
  id: TrimId;
  name: string;
  tagline: string;
  /** reservation amount in USD cents; null = invitation only */
  reservationCents: number | null;
  seats: number;
  zeroToSixty: string;
  highlights: string[];
};

export const TRIMS: Trim[] = [
  {
    id: "performance",
    name: "Performance",
    tagline: "Road ready",
    reservationCents: 50_000_00,
    seats: 2,
    zeroToSixty: "< 1.6 s",
    highlights: ["Multi-mode suction", "Two rear motors", "Active aero, Track Mode"],
  },
  {
    id: "thrust",
    name: "Thrust",
    tagline: "Race ready · adds rear thrusters",
    reservationCents: 250_000_00,
    seats: 2,
    zeroToSixty: "< 0.9 s",
    highlights: ["Rear cold-gas thrusters", "~200 L composite tanks", "Butterfly doors"],
  },
  {
    id: "rocket",
    name: "Rocket",
    tagline: "Air ready · invitation only",
    reservationCents: null,
    seats: 1,
    zeroToSixty: "< 0.59 s",
    highlights: ["10 thrusters around the body", "Flying abilities", "Seats one"],
  },
];

export const COLORS = [{ id: "ano-white", name: "Ano White", hex: "#ecebe6", note: "Shown at the reveal" }] as const;
export type ColorId = (typeof COLORS)[number]["id"];

/** Installment options for the reservation amount (0% demo financing). */
export const PLANS = [
  { id: "full", label: "Pay in full", months: 1 },
  { id: "3m", label: "3 monthly payments", months: 3 },
  { id: "6m", label: "6 monthly payments", months: 6 },
  { id: "12m", label: "12 monthly payments", months: 12 },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];

export type Currency = "USD" | "NGN";

/** Indicative display rate; settlement currency in this demo is USD. */
export const NGN_PER_USD = Number(process.env.NEXT_PUBLIC_NGN_PER_USD ?? 1550);

export const getTrim = (id: string) => TRIMS.find((t) => t.id === id);
export const getPlan = (id: string) => PLANS.find((p) => p.id === id);
