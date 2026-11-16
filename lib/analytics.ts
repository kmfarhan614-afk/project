import {
  daysBetween,
  eachDayKey,
  formatDayKey,
  formatMonthKey,
  formatRangeLabel,
  karachiDateKey,
  startOfWeekKey,
  weekdayName,
} from "./dates";
import { growthPercent, safePercent, sumPaisa } from "./finance";
import type {
  Customer,
  DateRange,
  Employee,
  EmployeePayout,
  Expense,
  Paisa,
  Sale,
  SaleItem,
} from "./types";

export interface TrendPoint {
  key: string;
  label: string;
  revenue: Paisa;
  expenses: Paisa;
  shopProfit: Paisa;
  sales: number;
}

export interface ServicePerformanceRow {
  service_id: string;
  name: string;
  count: number;
  quantity: number;
  revenue: Paisa;
  commission: Paisa;
  sharePct: number;
}

export interface EmployeePerformanceRow {
  employee_id: string;
  name: string;
  count: number;
  quantity: number;
  revenue: Paisa;
  commission: Paisa;
  paid: Paisa;
  outstanding: Paisa;
}

export interface ExpenseCategoryRow {
  name: string;
  amount: Paisa;
}

export interface ExpenseChangeRow {
  name: string;
  current: Paisa;
  previous: Paisa;
  changePct: number | null;
}

export interface DayExtreme {
  key: string;
  label: string;
  revenue: Paisa;
}

export interface BusinessSummary {
  range: DateRange;
  label: string;
  previousRange: DateRange;
  revenue: Paisa;
  subtotal: Paisa;
  discounts: Paisa;
  collected: Paisa;
  outstanding: Paisa;
  ceoEarnings: Paisa;
  employeeEarnings: Paisa;
  shopEarnings: Paisa;
  expenses: Paisa;
  netShopProfit: Paisa;
  salesCount: number;
  itemsSold: number;
  customerCount: number;
  walkInCount: number;
  repeatCustomers: number;
  averageTicket: Paisa;
  previousRevenue: Paisa;
  growthPct: number | null;
  trend: TrendPoint[];
  servicePerformance: ServicePerformanceRow[];
  employeePerformance: EmployeePerformanceRow[];
  expenseByCategory: ExpenseCategoryRow[];
  distribution: Array<{ name: string; value: Paisa }>;
  highestDay: DayExtreme | null;
  lowestDay: DayExtreme | null;
  busiestWeekday: { name: string; count: number } | null;
  expenseChanges: ExpenseChangeRow[];
}

export interface Insight {
  title: string;
  detail: string;
  recommendation?: string;
  tone: "positive" | "neutral" | "warning";
}

const INCLUDED_STATUSES = new Set(["completed", "partially_paid"]);

export function isIncludedSale(sale: Sale): boolean {
  return INCLUDED_STATUSES.has(sale.status);
}

export function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime();
}

function expenseInRange(expense: Expense, range: DateRange): boolean {
  const key = karachiDateKey(expense.expense_date);
  return key >= karachiDateKey(range.from) && key <= karachiDateKey(range.to);
}

function payoutInRange(payout: EmployeePayout, range: DateRange): boolean {
  return inRange(payout.paid_at, range);
}

type Granularity = "day" | "week" | "month" | "year";

function granularityFor(days: number): Granularity {
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  if (days <= 730) return "month";
  return "year";
}

function bucketKey(dateKey: string, granularity: Granularity): string {
  if (granularity === "day") return dateKey;
  if (granularity === "week") return startOfWeekKey(dateKey);
  if (granularity === "month") return dateKey.slice(0, 7);
  return dateKey.slice(0, 4);
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "day") return formatDayKey(key);
  if (granularity === "week") return `Wk ${formatDayKey(key)}`;
  if (granularity === "month") return formatMonthKey(key);
  return key;
}

function saleShopAmount(sale: Sale): Paisa {
  const allocated = sale.allocations
    .filter((a) => a.recipient_type === "shop")
    .reduce((sum, a) => sum + a.amount, 0);
  if (allocated !== 0 || sale.total === 0) return allocated;
  const ceo = sale.allocations
    .filter((a) => a.recipient_type === "ceo")
    .reduce((sum, a) => sum + a.amount, 0);
  const employees = sale.allocations
    .filter((a) => a.recipient_type === "employee")
    .reduce((sum, a) => sum + a.amount, 0);
  return sale.total - ceo - employees;
}

function buildTrend(
  sales: Sale[],
  expenses: Expense[],
  range: DateRange,
): TrendPoint[] {
  const granularity = granularityFor(daysBetween(range));
  const keys = new Set<string>();
  for (const day of eachDayKey(range)) keys.add(bucketKey(day, granularity));
  const map = new Map<string, TrendPoint>();
  for (const key of keys) {
    map.set(key, {
      key,
      label: bucketLabel(key, granularity),
      revenue: 0,
      expenses: 0,
      shopProfit: 0,
      sales: 0,
    });
  }
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    const key = bucketKey(karachiDateKey(sale.created_at), granularity);
    const point = map.get(key);
    if (!point) continue;
    point.revenue += sale.total;
    point.shopProfit += saleShopAmount(sale);
    point.sales += 1;
  }
  for (const expense of expenses) {
    if (!expenseInRange(expense, range)) continue;
    const key = bucketKey(karachiDateKey(expense.expense_date), granularity);
    const point = map.get(key);
    if (!point) continue;
    point.expenses += expense.amount;
    point.shopProfit -= expense.amount;
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function buildServicePerformance(sales: Sale[], revenueTotal: Paisa): ServicePerformanceRow[] {
  const map = new Map<string, ServicePerformanceRow>();
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    for (const item of sale.items) {
      const row = map.get(item.service_id) ?? {
        service_id: item.service_id,
        name: item.service_name,
        count: 0,
        quantity: 0,
        revenue: 0,
        commission: 0,
        sharePct: 0,
      };
      row.count += 1;
      row.quantity += item.quantity;
      row.revenue += item.net;
      row.commission += item.commission_amount;
      map.set(item.service_id, row);
    }
  }
  return Array.from(map.values())
    .map((row) => ({ ...row, sharePct: safePercent(row.revenue, revenueTotal) }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

function buildEmployeePerformance(
  sales: Sale[],
  payouts: EmployeePayout[],
  range: DateRange,
): EmployeePerformanceRow[] {
  const map = new Map<string, EmployeePerformanceRow>();
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    for (const item of sale.items) {
      const row = map.get(item.employee_id) ?? {
        employee_id: item.employee_id,
        name: item.employee_name,
        count: 0,
        quantity: 0,
        revenue: 0,
        commission: 0,
        paid: 0,
        outstanding: 0,
      };
      row.count += 1;
      row.quantity += item.quantity;
      row.revenue += item.net;
      row.commission += item.commission_amount;
      map.set(item.employee_id, row);
    }
  }
  for (const payout of payouts) {
    if (!payoutInRange(payout, range)) continue;
    const row = map.get(payout.employee_id);
    if (row) row.paid += payout.amount;
  }
  return Array.from(map.values())
    .map((row) => ({ ...row, outstanding: row.commission - row.paid }))
    .sort((a, b) => b.commission - a.commission || b.revenue - a.revenue);
}

function buildExpenseCategories(expenses: Expense[], range: DateRange): ExpenseCategoryRow[] {
  const map = new Map<string, Paisa>();
  for (const expense of expenses) {
    if (!expenseInRange(expense, range)) continue;
    map.set(expense.category_name, (map.get(expense.category_name) ?? 0) + expense.amount);
  }
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildDayExtremes(sales: Sale[], range: DateRange): {
  highest: DayExtreme | null;
  lowest: DayExtreme | null;
} {
  const map = new Map<string, Paisa>();
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    const key = karachiDateKey(sale.created_at);
    map.set(key, (map.get(key) ?? 0) + sale.total);
  }
  const rows = Array.from(map.entries())
    .filter(([key]) => key >= karachiDateKey(range.from) && key <= karachiDateKey(range.to))
    .map(([key, revenue]) => ({ key, label: formatDayKey(key), revenue }))
    .filter((row) => row.revenue > 0);
  if (!rows.length) return { highest: null, lowest: null };
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
}

function buildBusiestWeekday(sales: Sale[], range: DateRange): { name: string; count: number } | null {
  const map = new Map<string, number>();
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    if (!inRange(sale.created_at, range)) continue;
    const name = weekdayName(karachiDateKey(sale.created_at));
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  return rows.length ? { name: rows[0][0], count: rows[0][1] } : null;
}

export function summarize(
  sales: Sale[],
  expenses: Expense[],
  payouts: EmployeePayout[],
  range: DateRange,
): BusinessSummary {
  const included = sales.filter((s) => isIncludedSale(s) && inRange(s.created_at, range));
  const rangeExpenses = expenses.filter((e) => expenseInRange(e, range));
  const revenue = sumPaisa(included.map((s) => s.total));
  const subtotal = sumPaisa(included.map((s) => s.subtotal));
  const discounts = sumPaisa(included.map((s) => s.discount_amount));
  const collected = sumPaisa(
    included.flatMap((s) => s.payments.filter((p) => !p.is_refund).map((p) => p.amount)),
  );
  const outstanding = sumPaisa(included.map((s) => s.balance));
  const allocations = included.flatMap((s) => s.allocations);
  const ceoEarnings = sumPaisa(
    allocations.filter((a) => a.recipient_type === "ceo").map((a) => a.amount),
  );
  const employeeEarnings = sumPaisa(
    allocations.filter((a) => a.recipient_type === "employee").map((a) => a.amount),
  );
  const shopEarnings = sumPaisa(
    allocations.filter((a) => a.recipient_type === "shop").map((a) => a.amount),
  );
  const expenseTotal = sumPaisa(rangeExpenses.map((e) => e.amount));
  const items = included.flatMap((s) => s.items);
  const registeredCustomerIds = new Set(
    included.map((s) => s.customer_id).filter((id): id is string => Boolean(id)),
  );
  const walkInCount = included.filter((s) => !s.customer_id).length;
  const visitsByCustomer = new Map<string, number>();
  for (const sale of included) {
    if (!sale.customer_id) continue;
    visitsByCustomer.set(sale.customer_id, (visitsByCustomer.get(sale.customer_id) ?? 0) + 1);
  }
  const repeatCustomers = Array.from(visitsByCustomer.values()).filter((n) => n > 1).length;
  const dayExtremes = buildDayExtremes(included, range);
  const servicePerformance = buildServicePerformance(included, revenue);
  const employeePerformance = buildEmployeePerformance(included, payouts, range);
  const expenseByCategory = buildExpenseCategories(expenses, range);
  return {
    range,
    label: formatRangeLabel(range),
    previousRange: range,
    revenue,
    subtotal,
    discounts,
    collected,
    outstanding,
    ceoEarnings,
    employeeEarnings,
    shopEarnings,
    expenses: expenseTotal,
    netShopProfit: shopEarnings - expenseTotal,
    salesCount: included.length,
    itemsSold: items.reduce((sum, item) => sum + item.quantity, 0),
    customerCount: registeredCustomerIds.size + walkInCount,
    walkInCount,
    repeatCustomers,
    averageTicket: included.length ? Math.round(revenue / included.length) : 0,
    previousRevenue: 0,
    growthPct: null,
    trend: buildTrend(included, expenses, range),
    servicePerformance,
    employeePerformance,
    expenseByCategory,
    distribution: [
      { name: "CEO", value: ceoEarnings },
      { name: "Employees", value: employeeEarnings },
      { name: "Shop", value: shopEarnings },
    ],
    highestDay: dayExtremes.highest,
    lowestDay: dayExtremes.lowest,
    busiestWeekday: buildBusiestWeekday(included, range),
    expenseChanges: [],
  };
}

export function summarizeWithComparison(
  sales: Sale[],
  expenses: Expense[],
  payouts: EmployeePayout[],
  range: DateRange,
  previousRange: DateRange,
): BusinessSummary {
  const current = summarize(sales, expenses, payouts, range);
  const previous = summarize(sales, expenses, payouts, previousRange);
  const expenseMap = new Map(previous.expenseByCategory.map((row) => [row.name, row.amount]));
  const expenseChanges: ExpenseChangeRow[] = current.expenseByCategory.map((row) => {
    const prev = expenseMap.get(row.name) ?? 0;
    return {
      name: row.name,
      current: row.amount,
      previous: prev,
      changePct: growthPercent(row.amount, prev),
    };
  });
  return {
    ...current,
    previousRange,
    previousRevenue: previous.revenue,
    growthPct: growthPercent(current.revenue, previous.revenue),
    expenseChanges: expenseChanges.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity)),
  };
}

export interface EmployeeBalance {
  employee_id: string;
  accrued: Paisa;
  paid: Paisa;
  outstanding: Paisa;
  services: number;
  revenue: Paisa;
}

export function computeEmployeeBalances(
  employees: Employee[],
  sales: Sale[],
  payouts: EmployeePayout[],
): EmployeeBalance[] {
  const map = new Map<string, EmployeeBalance>();
  for (const employee of employees) {
    map.set(employee.id, {
      employee_id: employee.id,
      accrued: 0,
      paid: 0,
      outstanding: 0,
      services: 0,
      revenue: 0,
    });
  }
  for (const sale of sales) {
    if (!isIncludedSale(sale)) continue;
    for (const item of sale.items) {
      const row = map.get(item.employee_id);
      if (!row) continue;
      row.accrued += item.commission_amount;
      row.services += 1;
      row.revenue += item.net;
    }
  }
  for (const payout of payouts) {
    const row = map.get(payout.employee_id);
    if (row) row.paid += payout.amount;
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    outstanding: row.accrued - row.paid,
  }));
}

export interface CustomerStat {
  customer_id: string;
  visits: number;
  totalSpent: Paisa;
  lastVisit: string | null;
  outstanding: Paisa;
}

export function computeCustomerStats(customers: Customer[], sales: Sale[]): Map<string, CustomerStat> {
  const map = new Map<string, CustomerStat>();
  for (const customer of customers) {
    map.set(customer.id, {
      customer_id: customer.id,
      visits: 0,
      totalSpent: 0,
      lastVisit: null,
      outstanding: 0,
    });
  }
  for (const sale of sales) {
    if (!sale.customer_id || !isIncludedSale(sale)) continue;
    const row = map.get(sale.customer_id);
    if (!row) continue;
    row.visits += 1;
    row.totalSpent += sale.total;
    row.outstanding += sale.balance;
    if (!row.lastVisit || new Date(sale.created_at) > new Date(row.lastVisit)) {
      row.lastVisit = sale.created_at;
    }
  }
  return map;
}

export interface SaleCustomerHistoryRow {
  sale: Sale;
  items: SaleItem[];
}

export function customerHistory(sales: Sale[], customerId: string): Sale[] {
  return sales
    .filter((sale) => sale.customer_id === customerId && sale.status !== "voided")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function buildInsights(summary: BusinessSummary): Insight[] {
  const insights: Insight[] = [];
  const topService = summary.servicePerformance[0];
  if (topService) {
    insights.push({
      title: `${topService.name} leads service revenue`,
      detail: `${topService.name} generated ${topService.count} service lines and ${(topService.sharePct).toFixed(
        1,
      )}% of service revenue in ${summary.label}.`,
      recommendation:
        "Keep this service well stocked and visible in your menu. Check staff availability during peak hours.",
      tone: "positive",
    });
  }
  const topEmployee = summary.employeePerformance[0];
  if (topEmployee) {
    insights.push({
      title: `${topEmployee.name} is the top earner`,
      detail: `${topEmployee.name} completed ${topEmployee.count} service lines with commission of PKR ${(
        topEmployee.commission / 100
      ).toFixed(2)} in this period.`,
      recommendation:
        "Review the mix of services this employee performs and share successful techniques with the team.",
      tone: "neutral",
    });
  }
  if (summary.growthPct !== null) {
    const up = summary.growthPct >= 0;
    insights.push({
      title: up ? "Revenue is ahead of the previous period" : "Revenue is behind the previous period",
      detail: `Revenue changed by ${summary.growthPct.toFixed(1)}% compared with ${formatRangeLabel(
        summary.previousRange,
      )}.`,
      recommendation: up
        ? "Identify which services and staff drove the increase, and repeat the same scheduling pattern."
        : "Review low-traffic days and consider targeted reminders to previous customers. This is a historical comparison, not a guarantee of future results.",
      tone: up ? "positive" : "warning",
    });
  } else {
    insights.push({
      title: "No comparable revenue in the previous period",
      detail: "There was no recorded revenue in the previous comparison window, so growth cannot be calculated.",
      tone: "neutral",
    });
  }
  if (summary.busiestWeekday) {
    insights.push({
      title: `${summary.busiestWeekday.name} is the busiest day`,
      detail: `${summary.busiestWeekday.name} recorded ${summary.busiestWeekday.count} sales in ${summary.label}.`,
      recommendation: `Consider scheduling an extra stylist on ${summary.busiestWeekday.name} and keeping appointment slots available.`,
      tone: "neutral",
    });
  }
  if (summary.repeatCustomers > 0) {
    insights.push({
      title: "Repeat customers are returning",
      detail: `${summary.repeatCustomers} registered customer${
        summary.repeatCustomers === 1 ? "" : "s"
      } visited more than once in this period.`,
      recommendation:
        "A simple thank-you message or a reminder about their preferred service can help maintain the relationship.",
      tone: "positive",
    });
  }
  const rising = summary.expenseChanges.find(
    (row) => row.changePct !== null && row.changePct > 10 && row.current > 0,
  );
  if (rising) {
    insights.push({
      title: `${rising.name} expenses increased`,
      detail: `${rising.name} spending rose by ${rising.changePct?.toFixed(
        1,
      )}% versus the previous period.`,
      recommendation:
        "Review recent bills and supplier rates. Compare quotes before renewing recurring purchases.",
      tone: "warning",
    });
  }
  if (summary.outstanding > 0) {
    insights.push({
      title: "Outstanding balances need follow-up",
      detail: `PKR ${(summary.outstanding / 100).toFixed(2)} remains unpaid across recorded sales in ${summary.label}.`,
      recommendation: "Contact customers with a balance and record any payment in the sales screen.",
      tone: "warning",
    });
  }
  insights.push({
    title: "Average customer spend",
    detail: `Average spend per sale was PKR ${(summary.averageTicket / 100).toFixed(2)} across ${
      summary.salesCount
    } sales.`,
    recommendation:
      "Consider service bundles only where they make sense for the customer. Recommendations are based on historical data and do not guarantee revenue growth.",
    tone: "neutral",
  });
  return insights;
}
