import type { LocationType } from "../locations/location.types";
import type {
  PaymentMethod,
  PaymentType,
} from "../payment-methods/payment-method.types";
import type { TaxType } from "../tax-classes/tax-class.types";

type SaleStatus = "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED" | "VOIDED";

interface SaleEmployee {
  membershipId: string;
  fullName: string;
}

interface SaleLocation {
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
}

interface SaleItem {
  id: string;
  businessId: string;
  saleId: string;
  orderItemId: string;
  productId: string;
  categoryId: string | null;
  preparationAreaId: string | null;
  taxClassId: string | null;
  productName: string;
  categoryName: string | null;
  preparationAreaName: string | null;
  quantity: number;
  unitPrice: string;
  taxCode: string | null;
  taxName: string | null;
  taxType: TaxType | null;
  taxRate: string;
  priceIncludesTax: boolean;
  unitNetPrice: string;
  unitTaxAmount: string;
  discountAmount: string;
  lineNetTotal: string;
  lineTaxTotal: string;
  lineTotal: string;
  costTotal: string | null;
  grossProfitAmount: string | null;
  createdAt: Date;
}

interface SalePayment {
  id: string;
  businessId: string;
  saleId: string;
  paymentMethodId: string;
  processedByMembershipId: string;
  processedBy: SaleEmployee;
  cashMovementId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: boolean;
  affectsCash: boolean;
  allowsChange: boolean;
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
}

interface Sale {
  id: string;
  businessId: string;
  locationId: string;
  orderId: string;
  cashSessionId: string;
  commercialCustomerId: string | null;
  soldByMembershipId: string;
  soldBy: SaleEmployee;
  location: SaleLocation;
  status: SaleStatus;
  currencyCode: string;
  netSubtotal: string;
  taxTotal: string;
  discountTotal: string;
  tipTotal: string;
  total: string;
  paidTotal: string;
  changeTotal: string;
  voidedByMembershipId: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  soldAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: SaleItem[];
  payments: SalePayment[];
}

interface ResolvedSalePayment {
  paymentMethod: PaymentMethod;
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
  reference: string | null;
  notes: string | null;
}

interface CreateSaleData {
  orderId: string;
  cashSessionId: string;
  commercialCustomerId: string | null;
  soldByMembershipId: string;
  paidTotal: string;
  changeTotal: string;
  payments: ResolvedSalePayment[];
}

export type {
  CreateSaleData,
  ResolvedSalePayment,
  Sale,
  SaleEmployee,
  SaleItem,
  SaleLocation,
  SalePayment,
  SaleStatus,
};
