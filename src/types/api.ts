export type ApiRecord = Record<string, unknown>

export type ReservationStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAID'

export interface Book extends ApiRecord {
  bookId?: string
  id?: string
  title?: string
  author?: string
  unitPrice?: number | string
  price?: number
  stock?: number
  thumbnailUrl?: string
}

export interface ReservationItem {
  id?: string
  reservationId?: string
  bookId: string
  title?: string
  unitPrice?: number
}

export interface Reservation extends ApiRecord {
  id?: string
  reservationNo?: string
  customerName?: string
  customerEmail?: string
  expiresAt?: string
  completedAt?: string
  status?: ReservationStatus
  createdAt?: string
  items?: ReservationItem[]
  totalCost?: number
  paymentReceivedBy?: string
}

export interface RestockRequest extends ApiRecord {
  requestNo?: string
  bookId?: string
  quantity?: number
  reason?: string
  status?: string
  createdAt?: string
}

export interface CreateBookInput {
  title: string
  author: string
  price: number
  stock: number
  thumbnail?: File | null
}

export interface UpdateBookInput {
  title?: string
  author?: string
  price?: number
  stock?: number
  thumbnail?: File | null
}

export interface CreateReservationInput {
  customerName: string
  customerEmail?: string
  bookIds: string[]
  reservationHours?: number
}

export interface UpdateReservationAdminInput {
  customerName?: string
  customerEmail?: string
  bookIds?: string[]
  reservationHours?: number
}

export interface CreateRestockRequestInput {
  bookId: string
  quantity: number
  reason?: string
}

export interface UpdateStockInput {
  stock: number
}

export interface StaffLoginInput {
  staffId: string
  password?: string
  pin?: string
}

export interface StaffLoginResponse extends ApiRecord {
  accessToken: string
  tokenType?: string
  expiresInSeconds?: number
  message?: string
}

export interface StaffUser extends ApiRecord {
  id?: string
  staffId?: string
  firstName?: string
  lastName?: string
  isActive?: boolean
  lastLogin?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateStaffUserInput {
  firstName: string
  lastName?: string
  staffId: string
  password?: string
  pin?: string
}

export interface ResetStaffPasswordInput {
  password?: string
  pin?: string
}

export interface SalesSummaryFilters {
  from?: string
  to?: string
  paymentReceivedBy?: string
}

export interface SalesSummaryRow extends ApiRecord {
  section?: string
  date?: string
  ordersCount?: number
  itemsCount?: number
  grossSales?: number
  from?: string
  to?: string
  paymentReceivedBy?: string
}

export interface SalesSummaryTotals extends ApiRecord {
  ordersCount?: number
  itemsCount?: number
  grossSales?: number
}

export interface SalesSummaryDailyRow extends ApiRecord {
  date?: string
  ordersCount?: number
  itemsCount?: number
  grossSales?: number
  reservationNos?: string[]
  reservations?: Reservation[]
  byStaff?: SalesSummaryByStaffRow[]
}

export interface SalesSummaryByStaffRow extends ApiRecord {
  staffId?: string
  displayName?: string
  firstName?: string
  lastName?: string
  ordersCount?: number
  itemsCount?: number
  grossSales?: number
  reservationNos?: string[]
  reservations?: Reservation[]
}

export interface SalesSummaryStaffAggregateRow extends SalesSummaryByStaffRow {
  sales?: SalesSummaryDailyRow[]
}

export interface SalesSummaryResponse extends ApiRecord {
  filters?: {
    from?: string | null
    to?: string | null
    paymentReceivedBy?: string | null
  }
  totals?: SalesSummaryTotals
  byDay?: SalesSummaryDailyRow[]
  byStaff?: SalesSummaryStaffAggregateRow[]
}

export interface StockSalesOverviewTotals extends ApiRecord {
  booksCount?: number
  totalStock?: number
  stockSold?: number
  stockLeft?: number
}

export interface StockSalesOverviewBook extends ApiRecord {
  bookId?: string
  title?: string
  author?: string
  category?: string
  totalStock?: number
  stockSold?: number
  stockLeft?: number
}

export interface StockSalesOverviewResponse extends ApiRecord {
  totals?: StockSalesOverviewTotals
  books?: StockSalesOverviewBook[]
}
