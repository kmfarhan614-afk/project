import {
  addDaysToKey,
  currentKarachiDateInput,
  karachiDateKey,
  pktDateTimeToIso,
} from "@/lib/dates";
import { computeSaleFinancials, pkrToPaisa, resolveCommissionBps, statusForPayment } from "@/lib/finance";
import type {
  AppData,
  AuditLog,
  CommissionRule,
  Customer,
  EarningAllocation,
  Employee,
  EmployeePayout,
  Expense,
  ExpenseCategory,
  Payment,
  PaymentMethod,
  Sale,
  SaleItem,
  Service,
  ServiceCategory,
  ShopSettings,
} from "@/lib/types";

export const DEMO_ADMIN = {
  id: "demo-admin",
  email: "admin@newtrimmer.pk",
  name: "Ayesha Malik",
  role: "admin" as const,
  employeeId: null as string | null,
};

export const DEMO_STAFF = {
  id: "demo-staff",
  email: "staff@newtrimmer.pk",
  name: "Bilal Khan",
  role: "staff" as const,
  employeeId: "00000000-0000-4000-8000-000000000201",
};

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SETTINGS_ID = 1;

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function createDemoData(now: Date = new Date()): AppData {
  const random = mulberry32(20261111);
  const nowIso = now.toISOString();
  const todayKey = currentKarachiDateInput(now);

  const categories: ServiceCategory[] = [
    { id: id(1), name: "Hair", created_at: nowIso },
    { id: id(2), name: "Beard", created_at: nowIso },
    { id: id(3), name: "Styling", created_at: nowIso },
    { id: id(4), name: "Skin & Beauty", created_at: nowIso },
    { id: id(5), name: "Color", created_at: nowIso },
    { id: id(6), name: "Treatments", created_at: nowIso },
  ];

  const serviceDefs: Array<[string, number, number, number, number | null]> = [
    ["Signature Haircut", 1, 1500, 30, null],
    ["Beard Trim & Shape", 2, 700, 20, null],
    ["Hair Styling", 3, 2000, 45, null],
    ["Glow Facial", 4, 2800, 60, null],
    ["Hair Color", 5, 4800, 90, 4500],
    ["Keratin Treatment", 6, 8500, 120, 4000],
    ["Kids Haircut", 1, 900, 20, null],
    ["Royal Shave", 2, 600, 15, null],
    ["Bridal Styling", 3, 15000, 180, 3500],
    ["Head Massage", 6, 1600, 30, null],
    ["Waxing", 4, 2200, 40, null],
    ["Hair Spa", 6, 3800, 60, null],
    ["Beard Color", 5, 2500, 45, null],
    ["Party Makeup", 4, 6000, 75, null],
  ];

  const services: Service[] = serviceDefs.map((def, index) => {
    const category = categories.find((c) => c.id === id(def[1]))!;
    return {
      id: id(100 + index),
      name: def[0],
      category_id: category.id,
      category_name: category.name,
      price: pkrToPaisa(def[2]),
      duration_minutes: def[3],
      active: true,
      commission_override_bps: def[4],
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const employeeDefs: Array<[string, string, string, number, string]> = [
    ["Ayesha Malik", "Manager / Senior Stylist", "+92 300 1112233", 3500, "2021-03-15"],
    ["Bilal Khan", "Senior Stylist", "+92 301 2223344", 3800, "2022-06-01"],
    ["Sana Ahmed", "Beautician", "+92 302 3334455", 4000, "2022-09-12"],
    ["Hamza Ali", "Barber", "+92 303 4445566", 3000, "2023-01-20"],
    ["Zara Sheikh", "Stylist", "+92 304 5556677", 3600, "2023-08-05"],
  ];

  const employees: Employee[] = employeeDefs.map((def, index) => ({
    id: id(200 + index),
    code: `EMP-${String(index + 1).padStart(3, "0")}`,
    full_name: def[0],
    phone: def[2],
    email: `${def[0].toLowerCase().replace(/\s+/g, ".")}@newtrimmer.pk`,
    job_role: def[1],
    active: true,
    commission_bps: def[3],
    hire_date: def[4],
    notes: null,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const commissionRules: CommissionRule[] = [
    {
      id: id(500),
      employee_id: employees[1].id,
      service_id: services[4].id,
      commission_bps: 5000,
      active: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: id(501),
      employee_id: employees[2].id,
      service_id: services[3].id,
      commission_bps: 4500,
      active: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: id(502),
      employee_id: employees[3].id,
      service_id: services[1].id,
      commission_bps: 3500,
      active: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const customerDefs: Array<[string, string, string | null]> = [
    ["Fatima Noor", "+92 321 1234567", "Prefers evening appointments."],
    ["Ali Raza", "+92 322 2345678", null],
    ["Hina Shahid", "+92 323 3456789", "Sensitive skin — patch test before color."],
    ["Usman Tariq", "+92 324 4567890", null],
    ["Mariam Javed", "+92 325 5678901", "Regular facial client."],
    ["Bilal Hussain", "+92 326 6789012", null],
    ["Areeba Khan", "+92 327 7890123", "Bridal client — trial booked."],
    ["Hamza Iqbal", "+92 328 8901234", null],
    ["Noor Fatima", "+92 329 9012345", null],
    ["Saad Ahmed", "+92 330 0123456", "Prefers Bilal."],
    ["Iqra Aslam", "+92 331 1234509", null],
    ["Rizwan Malik", "+92 332 2345610", "Corporate client."],
    ["Mehwish Anwar", "+92 333 3456721", null],
    ["Shahid Mahmood", "+92 334 4567832", "Walk-in converted to regular."],
  ];

  const customers: Customer[] = customerDefs.map((def, index) => ({
    id: id(300 + index),
    code: `CUS-${String(index + 1).padStart(4, "0")}`,
    full_name: def[0],
    phone: def[1],
    notes: def[2],
    created_at: pktDateTimeToIso(addDaysToKey(todayKey, -120 + index * 3), 12, 0),
    updated_at: nowIso,
  }));

  const settings: ShopSettings = {
    id: SETTINGS_ID,
    shop_name: "New Trimmer Hair & Beauty Center",
    address: "Shop 12, Main Boulevard, Gulberg III, Lahore",
    phone: "+92 300 1234567",
    currency: "PKR",
    timezone: "Asia/Karachi",
    ceo_bps: 3000,
    employee_bps: 4000,
    shop_bps: 3000,
    receipt_footer: "Thank you for choosing New Trimmer. We look forward to seeing you again!",
    updated_at: nowIso,
  };

  const expenseCategoryNames = [
    "Shop rent",
    "Electricity",
    "Water",
    "Equipment",
    "Hair products",
    "Cleaning supplies",
    "Maintenance",
    "Salaries",
    "Miscellaneous",
  ];

  const expenseCategories: ExpenseCategory[] = expenseCategoryNames.map((name, index) => ({
    id: id(400 + index),
    name,
    created_at: nowIso,
  }));

  const activeServices = services.filter((s) => s.active);
  const activeEmployees = employees.filter((e) => e.active);
  const paymentMethods: PaymentMethod[] = ["cash", "cash", "cash", "bank_transfer", "bank_transfer", "card", "other"];
  const walkInNames = ["Walk-in guest", "Walk-in customer", "Walk-in guest", "Walk-in friend"];

  const sales: Sale[] = [];
  let saleCounter = 1;

  const daySalesCount = (dayOffset: number) => {
    const key = addDaysToKey(todayKey, -dayOffset);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    const busy = weekday === 5 || weekday === 6 || weekday === 0;
    if (dayOffset === 0) return 4;
    return Math.max(1, Math.floor(random() * (busy ? 6 : 4)) + (busy ? 2 : 1));
  };

  for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
    const dayKey = addDaysToKey(todayKey, -dayOffset);
    const count = daySalesCount(dayOffset);
    for (let s = 0; s < count; s += 1) {
      const hour = 10 + Math.floor(random() * 11);
      const minute = Math.floor(random() * 60);
      const createdAt = pktDateTimeToIso(dayKey, hour, minute);
      const isWalkIn = random() < 0.3;
      const customer = isWalkIn ? null : pick(random, customers);
      const itemCount = 1 + (random() < 0.42 ? 1 : 0) + (random() < 0.12 ? 1 : 0);
      const chosen: Service[] = [];
      while (chosen.length < itemCount) {
        const service = pick(random, activeServices);
        if (!chosen.some((c) => c.id === service.id)) chosen.push(service);
      }
      const itemInputs = chosen.map((service) => {
        const employee = pick(random, activeEmployees);
        const quantity = random() < 0.08 ? 2 : 1;
        const gross = service.price * quantity;
        const commission_bps = resolveCommissionBps({
          employeeDefaultBps: employee.commission_bps,
          serviceOverrideBps: service.commission_override_bps,
          rules: commissionRules,
          employeeId: employee.id,
          serviceId: service.id,
          fallbackBps: settings.employee_bps,
        });
        return { service, employee, quantity, gross, commission_bps };
      });
      const subtotal = itemInputs.reduce((sum, item) => sum + item.gross, 0);
      let discount = 0;
      let discountReason: string | null = null;
      if (random() < 0.16 && subtotal > 100000) {
        const pct = 5 + Math.floor(random() * 6);
        discount = Math.min(subtotal - 1000, roundTo((subtotal * pct) / 100, 5000));
        discountReason = pick(random, ["Loyalty discount", "Repeat customer", "Seasonal offer"]);
      }
      const computed = computeSaleFinancials({
        items: itemInputs.map((item) => ({
          gross: item.gross,
          commission_bps: item.commission_bps,
        })),
        discount_amount: discount,
        settings,
      });
      const saleId = id(10000 + saleCounter);
      const receiptDate = dayKey.replace(/-/g, "");
      const receiptNo = `NT-${receiptDate}-${String(saleCounter).padStart(4, "0")}`;
      const isVoided = random() < 0.015;
      const isRefunded = !isVoided && random() < 0.02;
      let paid: number;
      if (isVoided || isRefunded) paid = computed.total;
      else if (random() < 0.16) paid = roundTo(computed.total * (0.35 + random() * 0.4), 100);
      else paid = computed.total;
      paid = Math.min(paid, computed.total);
      const status = isVoided ? "voided" : isRefunded ? "refunded" : statusForPayment(computed.total, paid);
      const itemRows: SaleItem[] = itemInputs.map((item, index) => ({
        id: id(20000 + saleCounter * 10 + index),
        sale_id: saleId,
        service_id: item.service.id,
        service_name: item.service.name,
        employee_id: item.employee.id,
        employee_name: item.employee.full_name,
        quantity: item.quantity,
        unit_price: item.service.price,
        gross: item.gross,
        discount_share: computed.items[index].discount_share,
        net: computed.items[index].net,
        commission_bps: computed.items[index].commission_bps,
        commission_amount: computed.items[index].commission_amount,
        created_at: createdAt,
      }));
      const allocations: EarningAllocation[] = [
        {
          id: id(30000 + saleCounter * 10),
          sale_id: saleId,
          sale_item_id: null,
          recipient_type: "ceo",
          employee_id: null,
          employee_name: null,
          amount: computed.ceo_amount,
          percentage_bps: computed.ceo_bps,
          created_at: createdAt,
        },
        {
          id: id(30000 + saleCounter * 10 + 9),
          sale_id: saleId,
          sale_item_id: null,
          recipient_type: "shop",
          employee_id: null,
          employee_name: null,
          amount: computed.shop_amount,
          percentage_bps: computed.shop_bps,
          created_at: createdAt,
        },
        ...itemRows.map((item, index) => ({
          id: id(30000 + saleCounter * 10 + 1 + index),
          sale_id: saleId,
          sale_item_id: item.id,
          recipient_type: "employee" as const,
          employee_id: item.employee_id,
          employee_name: item.employee_name,
          amount: item.commission_amount,
          percentage_bps: item.commission_bps,
          created_at: createdAt,
        })),
      ];
      const payments: Payment[] = [];
      if (paid > 0) {
        payments.push({
          id: id(40000 + saleCounter * 10),
          sale_id: saleId,
          amount: paid,
          method: pick(random, paymentMethods),
          reference: null,
          received_at: createdAt,
          is_refund: false,
          client_token: null,
          created_at: createdAt,
        });
      }
      if (isRefunded) {
        payments.push({
          id: id(40000 + saleCounter * 10 + 1),
          sale_id: saleId,
          amount: -paid,
          method: "cash",
          reference: null,
          received_at: pktDateTimeToIso(addDaysToKey(dayKey, 1), 12, 0),
          is_refund: true,
          client_token: null,
          created_at: pktDateTimeToIso(addDaysToKey(dayKey, 1), 12, 0),
        });
      }
      sales.push({
        id: saleId,
        receipt_no: receiptNo,
        customer_id: customer?.id ?? null,
        customer_name: customer?.full_name ?? pick(random, walkInNames),
        subtotal: computed.subtotal,
        discount_amount: computed.discount_amount,
        discount_reason: discountReason,
        total: computed.total,
        paid_amount: isRefunded ? 0 : paid,
        balance: isRefunded ? 0 : computed.total - paid,
        status,
        ceo_bps: computed.ceo_bps,
        employee_bps: computed.employee_bps,
        shop_bps: computed.shop_bps,
        notes: null,
        client_token: id(50000 + saleCounter),
        refunded_amount: isRefunded ? computed.total : 0,
        refunded_reason: isRefunded ? "Customer refund — service not completed" : null,
        void_reason: isVoided ? "Duplicate ticket entered by mistake" : null,
        created_by: DEMO_ADMIN.id,
        created_by_name: DEMO_ADMIN.name,
        created_at: createdAt,
        updated_at: createdAt,
        items: itemRows,
        payments,
        allocations,
      });
      saleCounter += 1;
    }
  }

  sales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const expenses: Expense[] = [];
  let expenseCounter = 1;
  const addExpense = (
    dateKey: string,
    categoryName: string,
    amount: number,
    description: string,
    reference: string | null = null,
  ) => {
    const category = expenseCategories.find((c) => c.name === categoryName)!;
    const date = pktDateTimeToIso(dateKey, 11, 0);
    expenses.push({
      id: id(60000 + expenseCounter),
      category_id: category.id,
      category_name: category.name,
      amount: pkrToPaisa(amount),
      expense_date: dateKey,
      description,
      reference,
      created_by_name: DEMO_ADMIN.name,
      created_at: date,
      updated_at: date,
    });
    expenseCounter += 1;
  };

  for (let monthOffset = 3; monthOffset >= 0; monthOffset -= 1) {
    const base = new Date(`${todayKey}T12:00:00Z`);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() - monthOffset);
    const year = base.getUTCFullYear();
    const month = String(base.getUTCMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;
    const lastDay = new Date(Date.UTC(year, base.getUTCMonth() + 1, 0, 12)).getUTCDate();
    const cap = monthOffset === 0 ? Number(todayKey.slice(8, 10)) : lastDay;
    if (cap >= 1) addExpense(`${monthKey}-01`, "Shop rent", 120000, "Monthly shop rent", "RENT-2026");
    if (cap >= 3) addExpense(`${monthKey}-03`, "Water", 3500 + Math.floor(random() * 2000), "Water bill");
    if (cap >= 5) addExpense(`${monthKey}-05`, "Electricity", 22000 + Math.floor(random() * 12000), "Electricity bill");
    if (cap >= 8)
      addExpense(
        `${monthKey}-08`,
        "Hair products",
        18000 + Math.floor(random() * 20000),
        "Shampoo, color, and treatment stock",
        "INV-PROD",
      );
    if (cap >= 10) addExpense(`${monthKey}-10`, "Cleaning supplies", 4000 + Math.floor(random() * 4000), "Sanitizer and towels");
    if (cap >= 15 && random() < 0.7)
      addExpense(`${monthKey}-15`, "Maintenance", 5000 + Math.floor(random() * 12000), "Chair and equipment servicing");
    if (cap >= 20 && random() < 0.5)
      addExpense(`${monthKey}-20`, "Equipment", 8000 + Math.floor(random() * 25000), "New styling tool");
    if (cap >= 25) addExpense(`${monthKey}-25`, "Miscellaneous", 2000 + Math.floor(random() * 8000), "Tea, stationery, small items");
    if (cap >= 28)
      addExpense(
        `${monthKey}-28`,
        "Salaries",
        185000,
        "Base staff salaries — employee commissions are recorded separately and are NOT included here",
        "PAYROLL",
      );
  }

  const payouts: EmployeePayout[] = [];
  let payoutCounter = 1;
  for (let monthOffset = 2; monthOffset >= 1; monthOffset -= 1) {
    const base = new Date(`${todayKey}T12:00:00Z`);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() - monthOffset);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    for (const employee of employees) {
      const accrued = sales
        .filter((sale) => sale.status !== "voided" && sale.status !== "refunded")
        .filter((sale) => karachiDateKey(sale.created_at).startsWith(monthKey))
        .flatMap((sale) => sale.items)
        .filter((item) => item.employee_id === employee.id)
        .reduce((sum, item) => sum + item.commission_amount, 0);
      if (accrued <= 0) continue;
      const amount = roundTo(accrued * 0.8, 1000);
      if (amount <= 0) continue;
      const paidAt = pktDateTimeToIso(addDaysToKey(`${monthKey}-01`, lastDay + 4), 12, 0);
      payouts.push({
        id: id(70000 + payoutCounter),
        employee_id: employee.id,
        employee_name: employee.full_name,
        amount,
        method: payoutCounter % 3 === 0 ? "cash" : "bank_transfer",
        paid_at: paidAt,
        period_start: `${monthKey}-01`,
        period_end: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
        reference: `PAY-${monthKey}-${employee.code}`,
        notes: "Monthly commission payout (80% of accrued)",
        created_by_name: DEMO_ADMIN.name,
        created_at: paidAt,
      });
      payoutCounter += 1;
    }
  }

  const auditLogs: AuditLog[] = [
    {
      id: id(80000),
      actor_email: DEMO_ADMIN.email,
      action: "seed",
      entity: "system",
      entity_id: null,
      details: { message: "Demo data generated", sales: sales.length, expenses: expenses.length },
      created_at: nowIso,
    },
  ];

  return {
    customers,
    services,
    categories,
    employees,
    commissionRules,
    sales,
    expenses,
    expenseCategories,
    payouts,
    settings,
    auditLogs,
  };
}
