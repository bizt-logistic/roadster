// Data shapes returned by the site's admin API (mirror of the site's
// src/lib/server/repo.ts). Kept as a copy so this app stays independent.

export type Network = "btc-testnet" | "eth-sepolia";
export type Method = "btc" | "eth" | "bank" | "none";
export type OrderStatus = "payment_requested" | "awaiting_payment" | "partially_paid" | "paid" | "invitation_requested" | "cancelled";

export type Installment = {
  n: number;
  dueDate: string;
  amountCents: number;
  status: "due" | "submitted" | "paid";
  cryptoAmount?: string;
  txHash?: string;
  submittedAt?: string;
  paidAt?: string;
};

export type Destination =
  | { kind: "wallet"; walletId: string; network: Network; address: string }
  | { kind: "bank"; bankId: string; bankName: string; accountName: string; accountNumber: string; currency: string };

export type OrderKind = "reservation" | "test_drive";
export type Applies = OrderKind | "both";
export type BookingStatus = "scheduled" | "completed" | "no_show";
export type Booking = {
  packageId: string; packageName: string; durationMin: number; date: string; time: string;
  locationId: string; locationName: string; locationAddress: string; creditable: boolean; status: BookingStatus;
  country?: string; timeZone?: string; emailedAt?: string;
};

export type Order = {
  id: string;
  kind?: OrderKind;
  subtotalCents?: number;
  items?: { id: string; name: string; priceCents: number }[];
  discount?: { code: string; cents: number } | null;
  booking?: Booking;
  number: string;
  createdAt: string;
  status: OrderStatus;
  trimId: string;
  colorId: string;
  planId: string;
  totalCents: number;
  paidCents: number;
  schedule: Installment[];
  customer: { name: string; email: string; phone: string; country: string; city: string; address?: string };
  method: Method;
  destination: Destination | null;
  lockedRate: number | null;
  request?: { n: number; method: Method; requestedAt: string } | null;
  window?: { n: number; issuedAt: string; expiresAt: string } | null;
  events: { at: string; type: string; note: string; by: "customer" | "admin" | "system" }[];
};

export type Wallet = { id: string; network: Network; address: string; label: string; active: boolean; createdAt: string };
export type BankAccount = { id: string; bankName: string; accountName: string; accountNumber: string; currency: string; active: boolean; createdAt: string };
export type Settings = { btcUsd: number; ethUsd: number; updatedAt: string };
export type DrivePackage = { id: string; name: string; description: string; durationMin: number; priceCents: number; creditable: boolean; active: boolean };
export type DriveLocation = { id: string; name: string; country: string; timeZone: string; address: string; active: boolean };
export type EmailRecord = {
  id: string; createdAt: string; to: string; subject: string; text: string; html: string;
  kind: "meeting_point" | "meeting_point_update" | "other"; orderId?: string;
  status: "sent" | "logged" | "failed"; provider: "resend" | "none"; error?: string;
};
export const EUROPE_TIME_ZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam", "Europe/Brussels",
  "Europe/Zurich", "Europe/Vienna", "Europe/Rome", "Europe/Madrid", "Europe/Monaco", "Europe/Stockholm", "Europe/Copenhagen",
  "Europe/Oslo", "Europe/Warsaw", "Europe/Prague", "Europe/Athens", "Europe/Istanbul",
];
export type Addon = { id: string; name: string; description: string; priceCents: number; appliesTo: Applies; active: boolean };
export type Promo = {
  code: string; kind: "percent" | "fixed"; value: number; appliesTo: Applies; active: boolean;
  maxUses: number | null; used: number; expiresAt: string | null;
};
export type Catalog = {
  trims: { id: "performance" | "thrust" | "rocket"; reservationCents: number | null; available: boolean }[];
  testDrive: {
    enabled: boolean; cars: string[]; carPrices: Record<string, number>; packages: DrivePackage[]; locations: DriveLocation[]; slots: string[];
    capacityPerSlot: number; leadDays: number; horizonDays: number; closedWeekdays: number[];
  };
  addons: Addon[];
  promos: Promo[];
  updatedAt: string;
};

export const isDrive = (o: Order) => o.kind === "test_drive";
export const APPLIES_LABEL: Record<Applies, string> = { reservation: "Reservations", test_drive: "Test drives", both: "Both" };
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const BOOKING_LABEL: Record<BookingStatus, string> = { scheduled: "Scheduled", completed: "Completed", no_show: "No-show" };
export const driveDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** Today's date in Central European Time (bookings use each city's local time). */
export const cetToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

export type InvestorLead = {
  id: string; createdAt: string; name: string; email: string; phone: string; country: string;
  organization: string; investorType: string; ticket: string; interest: string; message: string;
};

export const NETWORKS: Record<Network, { label: string; asset: string; tx: (h: string) => string; address: (a: string) => string }> = {
  "btc-testnet": {
    label: "Bitcoin testnet",
    asset: "BTC",
    tx: (h) => `https://mempool.space/testnet/tx/${h}`,
    address: (a) => `https://mempool.space/testnet/address/${a}`,
  },
  "eth-sepolia": {
    label: "Ethereum Sepolia",
    asset: "ETH",
    tx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
    address: (a) => `https://sepolia.etherscan.io/address/${a}`,
  },
};

export const METHOD_LABEL: Record<Method, string> = {
  btc: "Bitcoin (testnet)",
  eth: "Ethereum (Sepolia)",
  bank: "Bank transfer",
  none: "None",
};

export const TRIM_NAME: Record<string, string> = { performance: "Performance", thrust: "Thrust", rocket: "Rocket" };
export const PLAN_LABEL: Record<string, string> = {
  full: "Pay in full",
  "3m": "3 monthly payments",
  "6m": "6 monthly payments",
  "12m": "12 monthly payments",
};

export const money = (cents: number) => {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
};

/** Where the next payment stands (mirror of the site's paymentState). */
export function payState(o: Order, now = Date.now()) {
  const next = o.schedule.find((s) => s.status === "due" || s.status === "submitted") ?? null;
  const win = next && o.window && o.window.n === next.n ? o.window : null;
  const live = !!win && new Date(win.expiresAt).getTime() > now;
  const requested = !!next && !!o.request && o.request.n === next.n && o.status !== "cancelled";
  return { next, win, live, expired: !!win && !live, requested };
}

/** "in 42 min", "3 h ago" */
export function relative(iso: string, now = Date.now()) {
  const d = new Date(iso).getTime() - now;
  const m = Math.round(Math.abs(d) / 60_000);
  const t = m < 60 ? `${m} min` : m < 2880 ? `${+(m / 60).toFixed(1)} h` : `${Math.round(m / 1440)} days`;
  return d >= 0 ? `in ${t}` : `${t} ago`;
}

export const EXPIRY_OPTIONS = [
  { min: 15, label: "15 minutes" },
  { min: 30, label: "30 minutes" },
  { min: 60, label: "1 hour" },
  { min: 180, label: "3 hours" },
  { min: 720, label: "12 hours" },
  { min: 1440, label: "24 hours" },
  { min: 2880, label: "48 hours" },
];
/** Plain number for a price input (USD, no symbol). */
export const usdInput = (cents: number) => String(cents / 100);

export const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
