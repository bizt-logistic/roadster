// Admin-managed offer catalogue: reservation prices, paid test drives,
// add-ons and promo codes. Stored by the repo and edited from the admin app;
// these defaults seed a fresh install. Shared by client and server — the
// server always recomputes amounts from the stored catalogue.
import type { TrimId } from "./catalog";

export type OrderKind = "reservation" | "test_drive";
export type Applies = OrderKind | "both";

export type TrimPrice = { id: TrimId; reservationCents: number | null; available: boolean };
export type DrivePackage = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  /** added on top of the car's test-drive price (0 = included) */
  priceCents: number;
  /** fee is credited towards a reservation made later */
  creditable: boolean;
  active: boolean;
};
/** A test-drive city. The meeting point stays private until the booking is paid, then it's emailed. */
export type DriveLocation = { id: string; name: string; country: string; timeZone: string; address: string; active: boolean };
export type Addon = { id: string; name: string; description: string; priceCents: number; appliesTo: Applies; active: boolean };
export type Promo = {
  code: string;
  kind: "percent" | "fixed";
  /** percent (1–100) or USD cents */
  value: number;
  appliesTo: Applies;
  active: boolean;
  maxUses: number | null;
  used: number;
  expiresAt: string | null;
};
export type TestDriveConfig = {
  enabled: boolean;
  cars: TrimId[];
  /** test-drive price per car, USD cents */
  carPrices: Record<TrimId, number>;
  packages: DrivePackage[];
  locations: DriveLocation[];
  /** local times in each city, "HH:MM" */
  slots: string[];
  capacityPerSlot: number;
  /** earliest booking is this many days ahead */
  leadDays: number;
  horizonDays: number;
  /** 0 = Sunday … 6 = Saturday */
  closedWeekdays: number[];
};
export type Catalog = {
  /** content region; older catalogues without it are migrated to Europe */
  region?: "europe";
  trims: TrimPrice[];
  testDrive: TestDriveConfig;
  addons: Addon[];
  promos: Promo[];
  updatedAt: string;
};
/** What the public pages receive: promo codes stay on the server. */
export type PublicCatalog = Omit<Catalog, "promos">;

export const EUROPE_TIME_ZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam", "Europe/Brussels",
  "Europe/Zurich", "Europe/Vienna", "Europe/Rome", "Europe/Madrid", "Europe/Monaco", "Europe/Stockholm", "Europe/Copenhagen",
  "Europe/Oslo", "Europe/Warsaw", "Europe/Prague", "Europe/Athens", "Europe/Istanbul",
];

const CITIES: DriveLocation[] = [
  { id: "london", name: "London", country: "United Kingdom", timeZone: "Europe/London", address: "Roadster Studio, 12 Berkeley Square, Mayfair, London W1J 6BS", active: true },
  { id: "paris", name: "Paris", country: "France", timeZone: "Europe/Paris", address: "Roadster Studio, 40 Avenue Montaigne, 75008 Paris", active: true },
  { id: "munich", name: "Munich", country: "Germany", timeZone: "Europe/Berlin", address: "Roadster Studio, Maximilianstraße 21, 80539 München", active: true },
  { id: "milan", name: "Milan", country: "Italy", timeZone: "Europe/Rome", address: "Roadster Studio, Via Montenapoleone 8, 20121 Milano", active: true },
  { id: "monaco", name: "Monaco", country: "Monaco", timeZone: "Europe/Monaco", address: "Roadster Studio, Avenue de Monte-Carlo 2, 98000 Monaco", active: true },
  { id: "amsterdam", name: "Amsterdam", country: "Netherlands", timeZone: "Europe/Amsterdam", address: "Roadster Studio, P.C. Hooftstraat 60, 1071 BZ Amsterdam", active: true },
  { id: "zurich", name: "Zurich", country: "Switzerland", timeZone: "Europe/Zurich", address: "Roadster Studio, Bahnhofstrasse 30, 8001 Zürich", active: true },
  { id: "madrid", name: "Madrid", country: "Spain", timeZone: "Europe/Madrid", address: "Roadster Studio, Calle de Serrano 46, 28001 Madrid", active: true },
];

export const DEFAULT_CATALOG: Catalog = {
  region: "europe",
  trims: [
    { id: "performance", reservationCents: 50_000_00, available: true },
    { id: "thrust", reservationCents: 250_000_00, available: true },
    { id: "rocket", reservationCents: null, available: true },
  ],
  testDrive: {
    enabled: true,
    cars: ["performance", "thrust", "rocket"],
    carPrices: { performance: 1_500_00, thrust: 2_500_00, rocket: 5_000_00 },
    packages: [
      {
        id: "city", name: "City drive", durationMin: 30, priceCents: 0, creditable: true, active: true,
        description: "A guided drive through the city with a product specialist.",
      },
      {
        id: "track", name: "Track experience", durationMin: 60, priceCents: 1_000_00, creditable: true, active: true,
        description: "Closed-course laps with Track Mode, launch control and a coach.",
      },
      {
        id: "vip", name: "VIP launch experience", durationMin: 120, priceCents: 3_000_00, creditable: true, active: true,
        description: "Chauffeured pickup, private briefing, track time and a thruster demonstration.",
      },
    ],
    locations: CITIES,
    slots: ["10:00", "12:00", "14:00", "16:00"],
    capacityPerSlot: 2,
    leadDays: 1,
    horizonDays: 21,
    closedWeekdays: [0],
  },
  addons: [
    { id: "priority", name: "Priority delivery slot", description: "Move to the front of the European delivery queue.", priceCents: 5_000_00, appliesTo: "reservation", active: true },
    { id: "plates", name: "Registration & plate number", description: "Registration, plates and papers handled in your country.", priceCents: 1_200_00, appliesTo: "reservation", active: true },
    { id: "protect", name: "3-year protection plan", description: "Extended cover for drive unit, battery and thrusters.", priceCents: 9_500_00, appliesTo: "reservation", active: true },
    { id: "ppf", name: "Ceramic coating & PPF", description: "Full-body paint protection film applied before delivery.", priceCents: 3_000_00, appliesTo: "reservation", active: true },
    { id: "media", name: "Photo & video of your drive", description: "Professional edit delivered within 48 hours.", priceCents: 120_00, appliesTo: "test_drive", active: true },
    { id: "pickup", name: "Chauffeured pickup", description: "We collect you anywhere in the city and drop you back.", priceCents: 80_00, appliesTo: "test_drive", active: true },
    { id: "guest", name: "Bring a guest", description: "One passenger rides along.", priceCents: 50_00, appliesTo: "test_drive", active: true },
  ],
  promos: [
    { code: "LAUNCH10", kind: "percent", value: 10, appliesTo: "test_drive", active: true, maxUses: 100, used: 0, expiresAt: null },
    { code: "EUROPE2026", kind: "fixed", value: 1_000_00, appliesTo: "reservation", active: true, maxUses: 50, used: 0, expiresAt: null },
  ],
  updatedAt: new Date(0).toISOString(),
};

/** Fill fields missing from an older stored catalogue with the defaults. */
export function withDefaults(c: Partial<Catalog> | null | undefined): Catalog {
  if (!c) return structuredClone(DEFAULT_CATALOG);
  const defaults = structuredClone(DEFAULT_CATALOG);
  const td = { ...defaults.testDrive, ...(c.testDrive ?? {}) };
  if (!c.testDrive?.carPrices) {
    // catalogues saved before per-car pricing: package prices become upgrades
    td.packages = td.packages.map((p) => defaults.testDrive.packages.find((d) => d.id === p.id) ?? p);
    td.cars = [...new Set([...td.cars, ...defaults.testDrive.cars])];
  }
  const out: Catalog = { ...defaults, ...c, testDrive: td };
  if (c.region !== "europe") {
    // first launch catalogues were set up for Abuja: switch them to European cities
    out.region = "europe";
    out.testDrive.locations = defaults.testDrive.locations;
    out.addons = out.addons.map((a) => {
      const d = defaults.addons.find((x) => x.id === a.id);
      return d && /abuja|fct/i.test(a.description) ? { ...a, description: d.description } : a;
    });
    out.testDrive.packages = out.testDrive.packages.map((p) => (/abuja/i.test(p.description) ? { ...p, description: "A guided drive through the city with a product specialist." } : p));
    out.promos = out.promos.map((p) => (p.code === "ABUJA2026" ? { ...p, code: "EUROPE2026" } : p));
  }
  // locations saved before cities had a country / time zone
  out.testDrive.locations = out.testDrive.locations.map((l) => ({ ...l, country: l.country ?? "", timeZone: l.timeZone ?? "Europe/Paris" }));
  return out;
}

/** Test-drive price for a car and experience. */
export const drivePrice = (cfg: TestDriveConfig, car: TrimId, pkg?: DrivePackage) => (cfg.carPrices[car] ?? 0) + (pkg?.priceCents ?? 0);
/** Cheapest test drive on offer. */
export function driveFrom(cfg: TestDriveConfig) {
  const cars = cfg.cars.map((c) => cfg.carPrices[c] ?? 0);
  const pkgs = cfg.packages.filter((p) => p.active).map((p) => p.priceCents);
  return cars.length ? Math.min(...cars) + (pkgs.length ? Math.min(...pkgs) : 0) : 0;
}

export const applies = (a: Applies, k: OrderKind) => a === "both" || a === k;

export function promoDiscount(
  p: Promo | undefined,
  kind: OrderKind,
  subtotalCents: number,
  now = new Date(),
): { ok: true; cents: number; label: string } | { ok: false; error: string } {
  if (!p || !p.active) return { ok: false, error: "That code isn't valid." };
  if (!applies(p.appliesTo, kind)) return { ok: false, error: kind === "test_drive" ? "That code is for reservations." : "That code is for test drives." };
  if (p.expiresAt && new Date(p.expiresAt) < now) return { ok: false, error: "That code has expired." };
  if (p.maxUses != null && p.used >= p.maxUses) return { ok: false, error: "That code has been fully used." };
  const raw = p.kind === "percent" ? Math.round((subtotalCents * Math.min(100, p.value)) / 100) : p.value;
  return { ok: true, cents: Math.min(raw, subtotalCents), label: p.kind === "percent" ? `${p.value}% off` : "off" };
}

// ── test-drive calendar (European cities; "today" is taken in Central European Time) ──
const CET_OFFSET_MS = 60 * 60 * 1000;
const cetToday = (now: Date) => new Date(now.getTime() + CET_OFFSET_MS);

/** A local date + time in a city's time zone, as a UTC instant. */
export function cityTime(date: string, time: string, timeZone: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** Bookable dates (YYYY-MM-DD) from leadDays to horizonDays ahead, skipping closed weekdays. */
export function driveDates(cfg: TestDriveConfig, now = new Date()): string[] {
  const t = cetToday(now);
  const out: string[] = [];
  for (let i = cfg.leadDays; i <= cfg.horizonDays; i++) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + i));
    if (!cfg.closedWeekdays.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const slotKey = (date: string, time: string, locationId: string) => `${date}|${time}|${locationId}`;

export function formatDriveDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
