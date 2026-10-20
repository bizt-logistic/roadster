// Crypto payment helpers shared by the checkout, receipt and admin.
//
// DEMO MODE: only test networks are accepted — Bitcoin testnet and Ethereum
// Sepolia. Their coins have no monetary value, so the whole flow can be
// demonstrated end to end without moving real money. Going live is a
// deliberate change for a company deploying under its own brand.
//
// Receiving addresses are watch-only: an admin pastes an address from their
// own wallet. Private keys never touch this server.

export type Method = "btc" | "eth" | "bank";
export type Network = "btc-testnet" | "eth-sepolia";

export const NETWORKS: Record<Network, {
  method: Exclude<Method, "bank">;
  asset: "BTC" | "ETH";
  label: string;
  decimals: number;
  explorerTx: (h: string) => string;
  explorerAddress: (a: string) => string;
}> = {
  "btc-testnet": {
    method: "btc",
    asset: "BTC",
    label: "Bitcoin testnet",
    decimals: 8,
    explorerTx: (h) => `https://mempool.space/testnet/tx/${h}`,
    explorerAddress: (a) => `https://mempool.space/testnet/address/${a}`,
  },
  "eth-sepolia": {
    method: "eth",
    asset: "ETH",
    label: "Ethereum Sepolia testnet",
    decimals: 6,
    explorerTx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
    explorerAddress: (a) => `https://sepolia.etherscan.io/address/${a}`,
  },
};

export const METHOD_NETWORK: Record<Exclude<Method, "bank">, Network> = { btc: "btc-testnet", eth: "eth-sepolia" };

export const METHOD_LABEL: Record<Method, string> = {
  btc: "Bitcoin (testnet)",
  eth: "Ethereum (Sepolia)",
  bank: "Bank transfer",
};

/** Convert USD cents to a crypto amount string at a USD rate, rounded up so the payer never underpays. */
export function cryptoAmount(cents: number, usdPerCoin: number, decimals: number) {
  const coins = cents / 100 / usdPerCoin;
  const f = 10 ** decimals;
  return (Math.ceil(coins * f) / f).toFixed(decimals);
}

/** BIP-21 (Bitcoin) / EIP-681 (Ethereum, Sepolia chain id 11155111) payment URIs for wallet apps. */
export function paymentUri(network: Network, address: string, amount: string, label: string) {
  if (network === "btc-testnet") return `bitcoin:${address}?amount=${amount}&label=${encodeURIComponent(label)}`;
  const wei = BigInt(Math.round(Number(amount) * 1e6)) * BigInt("1000000000000");
  return `ethereum:${address}@11155111?value=${wei.toString()}`;
}

// ── address validation ─────────────────────────────────────────────────────
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function polymod(values: number[]) {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= G[i];
  }
  return chk >>> 0;
}
const hrpExpand = (hrp: string) => [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));

/** Verifies a bech32 / bech32m SegWit address checksum for the given prefix. */
export function isBech32(addr: string, hrp: string) {
  const a = addr.toLowerCase();
  if (addr !== a && addr !== addr.toUpperCase()) return false;
  const pos = a.lastIndexOf("1");
  if (pos < 1 || a.slice(0, pos) !== hrp || a.length - pos - 1 < 6 || a.length > 90) return false;
  const data = [...a.slice(pos + 1)].map((c) => CHARSET.indexOf(c));
  if (data.some((d) => d < 0)) return false;
  const pm = polymod(hrpExpand(hrp).concat(data));
  return pm === 1 || pm === 0x2bc830a3; // bech32 | bech32m
}

export function validateAddress(network: Network, raw: string): { ok: true; address: string } | { ok: false; error: string } {
  const addr = raw.trim();
  if (network === "btc-testnet") {
    if (/^(bc1|[13])/i.test(addr)) return { ok: false, error: "That is a Bitcoin MAINNET address. Demo mode accepts testnet only (tb1…, m…, n…, 2…)." };
    if (/^tb1/i.test(addr)) return isBech32(addr, "tb") ? { ok: true, address: addr.toLowerCase() } : { ok: false, error: "Checksum failed — check the address." };
    if (/^[mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr)) return { ok: true, address: addr };
    return { ok: false, error: "Not a Bitcoin testnet address." };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return { ok: false, error: "Not an Ethereum address (0x + 40 hex characters)." };
  return { ok: true, address: addr };
}

export const isTxHash = (network: Network, h: string) =>
  network === "btc-testnet" ? /^[0-9a-fA-F]{64}$/.test(h.trim()) : /^0x[0-9a-fA-F]{64}$/.test(h.trim());

/** Sample addresses so the demo works before an admin adds their own (testnet; replace them). */
export const SAMPLE_WALLETS: { network: Network; address: string; label: string }[] = [
  { network: "btc-testnet", address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", label: "Sample BTC testnet (replace)" },
  { network: "eth-sepolia", address: "0x000000000000000000000000000000000000dEaD", label: "Sample Sepolia (replace)" },
];
