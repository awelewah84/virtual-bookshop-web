import type {
  Book,
  CreateStaffUserInput,
  CreateBookInput,
  CreateReservationInput,
  CreateRestockRequestInput,
  Reservation,
  ReservationStatus,
  UpdateReservationAdminInput,
  ResetStaffPasswordInput,
  RestockRequest,
  StaffLoginInput,
  StaffLoginResponse,
  SalesSummaryFilters,
  SalesSummaryDailyRow,
  SalesSummaryRow,
  SalesSummaryResponse,
  StaffUser,
  UpdateBookInput,
  UpdateStockInput,
} from '../types/api'
import { requestJson, resolveList } from './http'
import { API_BASE_URL } from './env'
import { getAccessToken } from '../auth/authStorage'

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }

    const stripped = value.replace(/[^0-9.-]/g, '')
    const parsedFromCurrency = Number(stripped)
    if (Number.isFinite(parsedFromCurrency)) {
      return parsedFromCurrency
    }

    return undefined
  }

  return undefined
}

function normalizeBook(raw: Book): Book {
  const price = toNumber(raw.price ?? raw.unitPrice)
  const stock = toNumber(raw.stock)
  const thumbnailUrl = typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : undefined

  return {
    ...raw,
    price,
    stock,
    thumbnailUrl,
  }
}

function appendIfPresent(formData: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    return
  }

  formData.append(key, String(value))
}

export async function loginStaff(payload: StaffLoginInput): Promise<StaffLoginResponse> {
  return requestJson<StaffLoginResponse>('/api/staff/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  const data = await requestJson<unknown>('/api/staff/admin/users')
  return resolveList<StaffUser>(data)
}

export async function createStaffUser(payload: CreateStaffUserInput): Promise<unknown> {
  return requestJson('/api/staff/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resetStaffUserPassword(staffId: string, payload: ResetStaffPasswordInput): Promise<unknown> {
  return requestJson(`/api/staff/admin/users/${staffId}/password`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deactivateStaffUser(staffId: string): Promise<unknown> {
  return requestJson(`/api/staff/admin/users/${staffId}/deactivate`, {
    method: 'PATCH',
  })
}

export async function activateStaffUser(staffId: string): Promise<unknown> {
  return requestJson(`/api/staff/admin/users/${staffId}/activate`, {
    method: 'PATCH',
  })
}

export async function getHealth(): Promise<unknown> {
  return requestJson<unknown>('/health')
}

export async function listCatalog(): Promise<Book[]> {
  const data = await requestJson<unknown>('/api/catalog')
  return resolveList<Book>(data).map((book) => normalizeBook(book))
}

export async function createBook(payload: CreateBookInput): Promise<unknown> {
  if (payload.thumbnail) {
    const body = new FormData()
    appendIfPresent(body, 'title', payload.title)
    appendIfPresent(body, 'author', payload.author)
    appendIfPresent(body, 'price', payload.price)
    appendIfPresent(body, 'stock', payload.stock)
    body.append('thumbnail', payload.thumbnail)

    return requestJson('/api/catalog', {
      method: 'POST',
      body,
    })
  }

  return requestJson('/api/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateBook(bookId: string, payload: UpdateBookInput): Promise<unknown> {
  const body = new FormData()
  appendIfPresent(body, 'title', payload.title)
  appendIfPresent(body, 'author', payload.author)
  appendIfPresent(body, 'price', payload.price)
  appendIfPresent(body, 'stock', payload.stock)

  if (payload.thumbnail) {
    body.append('thumbnail', payload.thumbnail)
  }

  return requestJson(`/api/catalog/${bookId}`, {
    method: 'PUT',
    body,
  })
}

export async function updateBookStock(bookId: string, payload: UpdateStockInput): Promise<unknown> {
  return requestJson(`/api/catalog/${bookId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function listReservations(): Promise<Reservation[]> {
  const data = await requestJson<unknown>('/api/reservations')
  return resolveList<Reservation>(data)
}

export async function listReservationsByStatus(status: ReservationStatus): Promise<Reservation[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const data = await requestJson<unknown>(`/api/reservations${query}`)
  return resolveList<Reservation>(data)
}

export async function createReservation(payload: CreateReservationInput): Promise<unknown> {
  return requestJson('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateReservationAdmin(reservationNo: string, payload: UpdateReservationAdminInput): Promise<unknown> {
  return requestJson(`/api/reservations/${reservationNo}/admin`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function completeReservation(reservationNo: string): Promise<unknown> {
  return requestJson(`/api/reservations/${reservationNo}/complete`, {
    method: 'POST',
  })
}

export async function listRestockRequests(): Promise<RestockRequest[]> {
  const data = await requestJson<unknown>('/api/restock-requests')
  return resolveList<RestockRequest>(data)
}

export async function createRestockRequest(payload: CreateRestockRequestInput): Promise<unknown> {
  return requestJson('/api/restock-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface CatalogImportResult {
  message?: string
  imported?: number
  updated?: number
}

export async function importCatalogFromExcel(file: File, sheetName?: string): Promise<CatalogImportResult> {
  const body = new FormData()
  body.append('file', file)

  if (sheetName && sheetName.trim().length > 0) {
    body.append('sheetName', sheetName.trim())
  }

  return requestJson<CatalogImportResult>('/api/catalog/import/excel', {
    method: 'POST',
    body,
  })
}

function makeQueryString(filters?: SalesSummaryFilters): string {
  const params = new URLSearchParams()

  if (filters?.from) {
    params.set('from', filters.from)
  }

  if (filters?.to) {
    params.set('to', filters.to)
  }

  if (filters?.paymentReceivedBy) {
    params.set('paymentReceivedBy', filters.paymentReceivedBy)
  }

  const text = params.toString()
  return text.length > 0 ? `?${text}` : ''
}

export async function getSalesSummary(filters?: SalesSummaryFilters): Promise<SalesSummaryRow[]> {
  const data = await requestJson<SalesSummaryResponse>(`/api/reports/sales-summary${makeQueryString(filters)}`)

  const totalsRow: SalesSummaryRow = {
    section: 'TOTAL',
    date: '',
    ordersCount: typeof data.totals?.ordersCount === 'number' ? data.totals.ordersCount : 0,
    itemsCount: typeof data.totals?.itemsCount === 'number' ? data.totals.itemsCount : 0,
    grossSales: typeof data.totals?.grossSales === 'number' ? data.totals.grossSales : 0,
    from: data.filters?.from ?? filters?.from ?? '',
    to: data.filters?.to ?? filters?.to ?? '',
    paymentReceivedBy: data.filters?.paymentReceivedBy ?? filters?.paymentReceivedBy ?? '',
  }

  const dayRows = (data.byDay ?? []).map((day: SalesSummaryDailyRow) => ({
    section: 'DAY',
    date: String(day.date ?? ''),
    ordersCount: typeof day.ordersCount === 'number' ? day.ordersCount : 0,
    itemsCount: typeof day.itemsCount === 'number' ? day.itemsCount : 0,
    grossSales: typeof day.grossSales === 'number' ? day.grossSales : 0,
    from: '',
    to: '',
    paymentReceivedBy: data.filters?.paymentReceivedBy ?? filters?.paymentReceivedBy ?? '',
      reservationNos: Array.isArray(day.reservationNos) ? day.reservationNos.map((value) => String(value)) : [],
      byStaff: Array.isArray(day.byStaff) ? day.byStaff : [],
  }))

  return [totalsRow, ...dayRows]
}

export async function exportSalesSummaryCsv(filters?: SalesSummaryFilters): Promise<Blob> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/api/reports/sales-summary.csv${makeQueryString(filters)}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with status ${response.status}`)
  }

  return response.blob()
}
