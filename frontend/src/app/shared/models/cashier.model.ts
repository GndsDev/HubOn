export interface PaymentMethodView {
  label: string;
  value: string;
  icon: string;
  selected?: boolean;
}

export interface CashierView {
  tab: string;
  table: string;
  waiter: string;
  itemsTotal: string;
  serviceFee: string;
  discount: string;
  total: string;
  paid: string;
  remaining: string;
  payments: PaymentMethodView[];
}

export interface UserView {
  name: string;
  role: string;
  status: string;
  lastAccess: string;
}

export interface ReportView {
  label: string;
  value: string;
  detail: string;
  icon: string;
}
