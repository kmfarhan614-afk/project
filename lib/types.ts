export type Role = "admin" | "staff";

export type SaleStatus =
  | "draft"
  | "completed"
  | "partially_paid"
  | "refunded"
  | "voided";

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";

export type RecipientType = "ceo" | "employee" | "shop";

export type Period = "today" | "week" | "month" | "year";

/** All monetary values are stored as integer paisa (PKR * 100). */
export type Paisa = number;

export interface Customer {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  price: Paisa;
  duration_minutes: number;
  active: boolean;
  commission_override_bps: number | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  job_role: string;
  active: boolean;
  commission_bps: number;
  hire_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionRule {
  id: string;
  employee_id: string | null;
  service_id: string | null;
  commission_bps: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopSettings {
  id: number;
  shop_name: string;
  address: string;
  phone: string;
  currency: "PKR";
  timezone: "Asia/Karachi";
  ceo_bps: number;
  employee_bps: number;
  shop_bps: number;
  receipt_footer: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  service_id: string;
  service_name: string;
  employee_id: string;
  employee_name: string;
  quantity: number;
  unit_price: Paisa;
  gross: Paisa;
  discount_share: Paisa;
  net: Paisa;
  commission_bps: number;
  commission_amount: Paisa;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: Paisa;
  method: PaymentMethod;
  reference: string | null;
  received_at: string;
  is_refund: boolean;
  client_token: string | null;
  created_at: string;
}

export interface EarningAllocation {
  id: string;
  sale_id: string;
  sale_item_id: string | null;
  recipient_type: RecipientType;
  employee_id: string | null;
  employee_name: string | null;
  amount: Paisa;
  percentage_bps: number;
  created_at: string;
}

export interface Sale {
  id: string;
  receipt_no: string;
  customer_id: string | null;
  customer_name: string;
  subtotal: Paisa;
  discount_amount: Paisa;
  discount_reason: string | null;
  total: Paisa;
  paid_amount: Paisa;
  balance: Paisa;
  status: SaleStatus;
  ceo_bps: number;
  employee_bps: number;
  shop_bps: number;
  notes: string | null;
  client_token: string | null;
  refunded_amount: Paisa;
  refunded_reason: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
  payments: Payment[];
  allocations: EarningAllocation[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  category_name: string;
  amount: Paisa;
  expense_date: string;
  description: string;
  reference: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeePayout {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: Paisa;
  method: PaymentMethod;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
  reference: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppData {
  customers: Customer[];
  services: Service[];
  categories: ServiceCategory[];
  employees: Employee[];
  commissionRules: CommissionRule[];
  sales: Sale[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  payouts: EmployeePayout[];
  settings: ShopSettings;
  auditLogs: AuditLog[];
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
}

export interface CustomerInput {
  id?: string;
  full_name: string;
  phone?: string | null;
  notes?: string | null;
}

export interface ServiceInput {
  id?: string;
  name: string;
  category_id: string;
  price: Paisa;
  duration_minutes: number;
  active: boolean;
  commission_override_bps: number | null;
}

export interface EmployeeInput {
  id?: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  job_role: string;
  active: boolean;
  commission_bps: number;
  hire_date?: string | null;
  notes?: string | null;
}

export interface CommissionRuleInput {
  id?: string;
  employee_id: string | null;
  service_id: string | null;
  commission_bps: number;
  active: boolean;
}

export interface ExpenseInput {
  id?: string;
  category_id: string;
  amount: Paisa;
  expense_date: string;
  description: string;
  reference?: string | null;
}

export interface PayoutInput {
  employee_id: string;
  amount: Paisa;
  method: PaymentMethod;
  paid_at: string;
  period_start?: string | null;
  period_end?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface SaleItemInput {
  service_id: string;
  employee_id: string;
  quantity: number;
}

export interface PaymentInput {
  amount: Paisa;
  method: PaymentMethod;
  reference?: string | null;
  client_token?: string;
}

export interface SaleInput {
  customer_id: string | null;
  walk_in_name?: string | null;
  items: SaleItemInput[];
  discount_amount: Paisa;
  discount_reason?: string | null;
  notes?: string | null;
  payment: PaymentInput | null;
  client_token: string;
}

export interface DateRange {
  from: string;
  to: string;
}
