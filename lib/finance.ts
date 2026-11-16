import type { Paisa, SaleStatus, ShopSettings } from "./types";

export const BPS_DENOMINATOR = 10_000;

export class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceError";
  }
}

/** Round a non-negative rational number half-up using integer math only. */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new FinanceError("Invalid rounding input.");
  }
  if (denominator <= 0) throw new FinanceError("Denominator must be positive.");
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(Math.trunc(numerator));
  const d = Math.trunc(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}

export function applyBps(amount: Paisa, bps: number): Paisa {
  return roundHalfUp(amount * bps, BPS_DENOMINATOR);
}

/**
 * Parse a user-entered PKR amount into integer paisa without floating point
 * arithmetic. Accepts "1,200.50", "Rs 1200", "1200.5", and numbers.
 */
export function pkrToPaisa(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  let raw = typeof input === "number" ? String(input) : input.trim();
  raw = raw.replace(/pkr/gi, "").replace(/rs\.?/gi, "").replace(/,/g, "").trim();
  if (!raw) return 0;
  if (!/^-?\d+(\.\d{0,2})?$/.test(raw)) {
    throw new FinanceError(`Invalid PKR amount: "${input}"`);
  }
  const negative = raw.startsWith("-");
  if (negative) raw = raw.slice(1);
  const [whole, fraction = ""] = raw.split(".");
  const paisa = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paisa)) {
    throw new FinanceError("Amount is too large.");
  }
  return negative ? -paisa : paisa;
}

export function paisaToPkrString(paisa: Paisa): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paisa));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Numeric string suitable for PostgreSQL NUMERIC(14,2). */
export function paisaToNumeric(paisa: Paisa): string {
  return paisaToPkrString(paisa);
}

export function numericToPaisa(value: string | number | null | undefined): number {
  return pkrToPaisa(value ?? 0);
}

export function formatPKR(paisa: Paisa, compact = false): string {
  if (compact) {
    const abs = Math.abs(paisa);
    if (abs >= 10_000_000_00) {
      return `PKR ${(paisa / 10_000_000_00).toFixed(1)}Cr`;
    }
    if (abs >= 100_000_00) {
      return `PKR ${(paisa / 100_000_00).toFixed(1)}L`;
    }
    if (abs >= 1_000_00) {
      return `PKR ${(paisa / 1_000_00).toFixed(1)}K`;
    }
  }
  return `PKR ${new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paisa / 100)}`;
}

export function formatPct(bps: number, decimals = 1): string {
  return `${(bps / 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function percentToBps(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
    throw new FinanceError(`Invalid percentage: "${input}"`);
  }
  const [whole, fraction = ""] = raw.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (bps > BPS_DENOMINATOR) {
    throw new FinanceError("Percentage cannot exceed 100%.");
  }
  return bps;
}

export function bpsToPercentInput(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Distribute an integer amount proportionally using the largest-remainder
 * method. The returned values always sum exactly to `total`.
 */
export function allocateProportionally(total: Paisa, weights: number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new FinanceError("Invalid total.");
  if (weights.length === 0) return [];
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new FinanceError("Weights must be non-negative numbers.");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    const base = Math.trunc(total / weights.length);
    const out = new Array(weights.length).fill(base);
    out[out.length - 1] += total - base * weights.length;
    return out;
  }
  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);
  const base = weights.map((w) => Math.floor((absTotal * w) / weightSum));
  let remainder = absTotal - base.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, index) => ({
      index,
      fraction: (absTotal * w) % weightSum,
    }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    base[order[i].index] += 1;
    remainder -= 1;
  }
  return base.map((value) => value * sign);
}

export interface CommissionContext {
  employeeDefaultBps: number;
  serviceOverrideBps: number | null;
  rules: Array<{
    employee_id: string | null;
    service_id: string | null;
    commission_bps: number;
    active: boolean;
  }>;
  employeeId: string;
  serviceId: string;
  fallbackBps: number;
}

export function resolveCommissionBps(ctx: CommissionContext): number {
  const activeRules = ctx.rules.filter((r) => r.active);
  const employeeService = activeRules.find(
    (r) => r.employee_id === ctx.employeeId && r.service_id === ctx.serviceId,
  );
  if (employeeService) return clampBps(employeeService.commission_bps);
  const serviceOnly = activeRules.find(
    (r) => r.employee_id === null && r.service_id === ctx.serviceId,
  );
  if (serviceOnly) return clampBps(serviceOnly.commission_bps);
  if (ctx.serviceOverrideBps !== null) return clampBps(ctx.serviceOverrideBps);
  return clampBps(ctx.employeeDefaultBps || ctx.fallbackBps);
}

function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(BPS_DENOMINATOR, Math.max(0, Math.round(bps)));
}

export interface SaleFinancialInput {
  items: Array<{ gross: Paisa; commission_bps: number }>;
  discount_amount: Paisa;
  settings: Pick<ShopSettings, "ceo_bps" | "employee_bps" | "shop_bps">;
}

export interface ComputedSaleItem {
  discount_share: Paisa;
  net: Paisa;
  commission_bps: number;
  commission_amount: Paisa;
}

export interface ComputedSale {
  subtotal: Paisa;
  discount_amount: Paisa;
  total: Paisa;
  ceo_bps: number;
  employee_bps: number;
  shop_bps: number;
  items: ComputedSaleItem[];
  ceo_amount: Paisa;
  employee_amount: Paisa;
  shop_amount: Paisa;
}

/**
 * Deterministic sale calculation.
 *
 * - Discount is spread across items with largest-remainder rounding.
 * - Employee commission is computed per item from the item's snapshot rate.
 * - CEO allocation uses the snapshot CEO percentage.
 * - Shop allocation is the exact remainder, so every paisa is allocated once.
 *
 * The configured employee percentage is a default commission target; actual
 * employee earnings come from per-item commission rates. The shop receives the
 * remainder. This keeps per-employee/per-service overrides meaningful and
 * guarantees that CEO + employees + shop always equals the sale total.
 */
export function computeSaleFinancials(input: SaleFinancialInput): ComputedSale {
  const { items, discount_amount: discount, settings } = input;
  if (!items.length) throw new FinanceError("A sale must contain at least one service.");
  if (items.some((i) => !Number.isSafeInteger(i.gross) || i.gross < 0)) {
    throw new FinanceError("Item amounts must be valid non-negative paisa values.");
  }
  const { ceo_bps, employee_bps, shop_bps } = settings;
  if (
    !Number.isInteger(ceo_bps) ||
    !Number.isInteger(employee_bps) ||
    !Number.isInteger(shop_bps) ||
    ceo_bps < 0 ||
    employee_bps < 0 ||
    shop_bps < 0 ||
    ceo_bps + employee_bps + shop_bps !== BPS_DENOMINATOR
  ) {
    throw new FinanceError("Distribution percentages must be non-negative and total exactly 100%.");
  }
  const subtotal = items.reduce((sum, item) => sum + item.gross, 0);
  if (!Number.isSafeInteger(discount) || discount < 0) {
    throw new FinanceError("Discount must be a valid non-negative amount.");
  }
  if (discount > subtotal) throw new FinanceError("Discount cannot exceed the subtotal.");
  const total = subtotal - discount;
  const discountShares = allocateProportionally(
    discount,
    items.map((item) => item.gross),
  );
  const computedItems: ComputedSaleItem[] = items.map((item, index) => {
    const net = item.gross - discountShares[index];
    const bps = clampBps(item.commission_bps);
    return {
      discount_share: discountShares[index],
      net,
      commission_bps: bps,
      commission_amount: applyBps(net, bps),
    };
  });
  const employeeAmount = computedItems.reduce((sum, item) => sum + item.commission_amount, 0);
  const ceoAmount = applyBps(total, ceo_bps);
  const shopAmount = total - ceoAmount - employeeAmount;
  if (shopAmount < 0) {
    throw new FinanceError(
      "Employee commissions and CEO allocation exceed the sale total. Reduce commission rates or the CEO share.",
    );
  }
  return {
    subtotal,
    discount_amount: discount,
    total,
    ceo_bps,
    employee_bps,
    shop_bps,
    items: computedItems,
    ceo_amount: ceoAmount,
    employee_amount: employeeAmount,
    shop_amount: shopAmount,
  };
}

export function statusForPayment(total: Paisa, paid: Paisa): SaleStatus {
  if (paid >= total && total > 0) return "completed";
  if (paid > 0) return "partially_paid";
  return "partially_paid";
}

export function sumPaisa(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function safePercent(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
