import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportSalesSummaryCsv, exportStockSalesOverviewCsv, getSalesSummary, getStockSalesOverview, listStaffUsers } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { formatCurrency } from '../lib/currency'
import type { Reservation, SalesSummaryByStaffRow, SalesSummaryRow } from '../types/api'

type ReportTab = 'sales' | 'stock-overview'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDateFromOffset(daysOffset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().slice(0, 10)
}

function monthStartIsoDate(): string {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return 0
}

function mergeReservations(existing: Reservation[] | undefined, incoming: Reservation[] | undefined): Reservation[] {
  const byReservationNo = new Map<string, Reservation>()

  for (const reservation of existing ?? []) {
    const reservationNo = String(reservation.reservationNo ?? '').trim()
    if (!reservationNo) {
      continue
    }

    byReservationNo.set(reservationNo, reservation)
  }

  for (const reservation of incoming ?? []) {
    const reservationNo = String(reservation.reservationNo ?? '').trim()
    if (!reservationNo) {
      continue
    }

    byReservationNo.set(reservationNo, reservation)
  }

  return [...byReservationNo.values()].sort((left, right) =>
    String(left.reservationNo ?? '').localeCompare(String(right.reservationNo ?? '')),
  )
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function mergeSalesSummaryRows(
  groupedRows: SalesSummaryRow[][],
  from: string | undefined,
  to: string | undefined,
  selectedStaffIds: string[],
): SalesSummaryRow[] {
  let totalOrders = 0
  let totalItems = 0
  let totalGross = 0
  const byDay = new Map<
    string,
    {
      ordersCount: number
      itemsCount: number
      grossSales: number
      reservationNos: Set<string>
      reservations: Reservation[]
      byStaff: Map<string, SalesSummaryByStaffRow>
    }
  >()

  for (const rows of groupedRows) {
    for (const row of rows) {
      const section = String(row.section ?? '').toUpperCase()

      if (section === 'TOTAL') {
        totalOrders += toSafeNumber(row.ordersCount)
        totalItems += toSafeNumber(row.itemsCount)
        totalGross += toSafeNumber(row.grossSales)
        continue
      }

      if (section !== 'DAY') {
        continue
      }

      const date = String(row.date ?? '')
      if (!date) {
        continue
      }

      const current = byDay.get(date) ?? {
        ordersCount: 0,
        itemsCount: 0,
        grossSales: 0,
        reservationNos: new Set<string>(),
        reservations: [],
        byStaff: new Map<string, SalesSummaryByStaffRow>(),
      }
      current.ordersCount += toSafeNumber(row.ordersCount)
      current.itemsCount += toSafeNumber(row.itemsCount)
      current.grossSales += toSafeNumber(row.grossSales)

      for (const reservationNo of Array.isArray(row.reservationNos) ? row.reservationNos : []) {
        current.reservationNos.add(String(reservationNo))
      }

      current.reservations = mergeReservations(current.reservations, Array.isArray(row.reservations) ? row.reservations : [])

      const byStaffRows = Array.isArray(row.byStaff) ? row.byStaff : []
      for (const byStaffRow of byStaffRows) {
        const staffId = String(byStaffRow.staffId ?? '').trim()
        if (!staffId) {
          continue
        }

        const existing = current.byStaff.get(staffId)
        const mergedReservationNos = new Set<string>(
          (existing?.reservationNos ?? []).map((value) => String(value)),
        )

        for (const reservationNo of Array.isArray(byStaffRow.reservationNos) ? byStaffRow.reservationNos : []) {
          mergedReservationNos.add(String(reservationNo))
        }

        current.byStaff.set(staffId, {
          staffId,
          displayName: byStaffRow.displayName,
          firstName: byStaffRow.firstName,
          lastName: byStaffRow.lastName,
          ordersCount: toSafeNumber(existing?.ordersCount) + toSafeNumber(byStaffRow.ordersCount),
          itemsCount: toSafeNumber(existing?.itemsCount) + toSafeNumber(byStaffRow.itemsCount),
          grossSales: Number((toSafeNumber(existing?.grossSales) + toSafeNumber(byStaffRow.grossSales)).toFixed(2)),
          reservationNos: [...mergedReservationNos],
          reservations: mergeReservations(
            Array.isArray(existing?.reservations) ? existing.reservations : [],
            Array.isArray(byStaffRow.reservations) ? byStaffRow.reservations : [],
          ),
        })
      }

      byDay.set(date, current)
    }
  }

  const totalRow: SalesSummaryRow = {
    section: 'TOTAL',
    date: '',
    ordersCount: totalOrders,
    itemsCount: totalItems,
    grossSales: Number(totalGross.toFixed(2)),
    from: from ?? '',
    to: to ?? '',
    paymentReceivedBy: selectedStaffIds.join('|'),
  }

  const dayRows = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]): SalesSummaryRow => ({
      section: 'DAY',
      date,
      ordersCount: values.ordersCount,
      itemsCount: values.itemsCount,
      grossSales: Number(values.grossSales.toFixed(2)),
      from: '',
      to: '',
      paymentReceivedBy: selectedStaffIds.join('|'),
      reservationNos: [...values.reservationNos],
      reservations: values.reservations,
      byStaff: [...values.byStaff.values()],
    }))

  return [totalRow, ...dayRows]
}

export function AdminReconciliationPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<ReportTab>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayIsoDate())
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingStockOverview, setIsExportingStockOverview] = useState(false)
  const [expandedDays, setExpandedDays] = useState<string[]>([])

  const staffUsersQuery = useQuery({ queryKey: ['staff-users'], queryFn: listStaffUsers })

  const normalizedSelectedStaffIds = useMemo(
    () => [...new Set(selectedStaffIds.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [selectedStaffIds],
  )

  const staffLabelById = useMemo(() => {
    const map = new Map<string, string>()

    for (const user of staffUsersQuery.data ?? []) {
      const staffId = String(user.staffId ?? '').trim()
      if (!staffId) {
        continue
      }

      const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : ''
      const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : ''
      const joinedName = `${firstName} ${lastName}`.trim()

      const displayCandidate =
        joinedName ||
        (typeof user.name === 'string'
          ? user.name
          : typeof user.displayName === 'string'
            ? user.displayName
            : typeof user.fullName === 'string'
              ? user.fullName
              : '')

      const name = displayCandidate.trim()
      map.set(staffId, name && name.toLowerCase() !== staffId.toLowerCase() ? `${name} (${staffId})` : staffId)
    }

    return map
  }, [staffUsersQuery.data])

  const formatStaffLabel = (staffValue: string): string => {
    const trimmed = staffValue.trim()
    if (!trimmed) {
      return '-'
    }

    const ids = trimmed.split('|').map((value) => value.trim()).filter(Boolean)
    if (ids.length === 0) {
      return '-'
    }

    return ids.map((id) => staffLabelById.get(id) ?? id).join(', ')
  }

  const formatByStaffRowName = (row: SalesSummaryByStaffRow): string => {
    const staffId = String(row.staffId ?? '').trim()
    const displayName = String(row.displayName ?? '').trim()
    const firstName = String(row.firstName ?? '').trim()
    const lastName = String(row.lastName ?? '').trim()
    const joined = `${firstName} ${lastName}`.trim()

    if (!staffId) {
      return displayName || joined || '-'
    }

    if (displayName) {
      return `${displayName} (${staffId})`
    }

    if (joined) {
      return `${joined} (${staffId})`
    }

    return staffLabelById.get(staffId) ?? staffId
  }

  const selectedStaffLabel =
    normalizedSelectedStaffIds.length > 0
      ? normalizedSelectedStaffIds.map((id) => staffLabelById.get(id) ?? id).join(', ')
      : 'All staff'

  const renderReservationDetails = (reservations: Reservation[] | undefined, emptyMessage: string) => {
    const rows = Array.isArray(reservations) ? reservations : []

    if (rows.length === 0) {
      return <p>{emptyMessage}</p>
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reservation No</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Items</th>
              <th>Total</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((reservation, reservationIndex) => {
              const reservationNo = String(reservation.reservationNo ?? `reservation-${reservationIndex + 1}`)
              const itemTitles = (Array.isArray(reservation.items) ? reservation.items : [])
                .map((item) => String(item.title ?? '').trim())
                .filter(Boolean)

              return (
                <tr key={reservationNo}>
                  <td>{reservationNo}</td>
                  <td>{String(reservation.customerName ?? '-')}</td>
                  <td>{String(reservation.customerEmail ?? '-')}</td>
                  <td>{itemTitles.length > 0 ? itemTitles.join(', ') : '-'}</td>
                  <td>{formatCurrency(reservation.totalCost)}</td>
                  <td>{formatDateTime(typeof reservation.completedAt === 'string' ? reservation.completedAt : undefined)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      paymentReceivedBy: normalizedSelectedStaffIds.length === 1 ? normalizedSelectedStaffIds[0] : undefined,
    }),
    [from, normalizedSelectedStaffIds, to],
  )

  const summaryQuery = useQuery({
    queryKey: ['sales-summary', filters.from ?? '', filters.to ?? '', normalizedSelectedStaffIds.join('|')],
    queryFn: async () => {
      if (normalizedSelectedStaffIds.length <= 1) {
        return getSalesSummary(filters)
      }

      const groupedRows = await Promise.all(
        normalizedSelectedStaffIds.map((staffId) =>
          getSalesSummary({
            from: filters.from,
            to: filters.to,
            paymentReceivedBy: staffId,
          }),
        ),
      )

      return mergeSalesSummaryRows(groupedRows, filters.from, filters.to, normalizedSelectedStaffIds)
    },
  })

  const stockOverviewQuery = useQuery({
    queryKey: ['stock-sales-overview'],
    queryFn: getStockSalesOverview,
  })

  async function handleExport(): Promise<void> {
    try {
      setIsExporting(true)
      const blob = await exportSalesSummaryCsv(filters)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const nameFrom = filters.from ?? 'all'
      const nameTo = filters.to ?? 'all'
      const staffSuffix = normalizedSelectedStaffIds.length === 0 ? 'all-staff' : normalizedSelectedStaffIds.join('+')
      link.href = url
      link.download = `sales-summary-${nameFrom}-to-${nameTo}-${staffSuffix}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CSV export downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleStockOverviewExport(): Promise<void> {
    try {
      setIsExportingStockOverview(true)
      const blob = await exportStockSalesOverviewCsv()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'stock-sales-overview.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Stock overview CSV export downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stock overview export failed')
    } finally {
      setIsExportingStockOverview(false)
    }
  }

  return (
    <section className="panel">
      <h2>Admin Reconciliation</h2>
      <p className="panel-note">Review finance and stock reports from one place.</p>

      <div className="report-tabs" role="tablist" aria-label="Reports">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sales'}
          className={`report-tab${activeTab === 'sales' ? ' active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stock-overview'}
          className={`report-tab${activeTab === 'stock-overview' ? ' active' : ''}`}
          onClick={() => setActiveTab('stock-overview')}
        >
          Stock Sales Overview
        </button>
      </div>

      {activeTab === 'sales' && (
        <>
          <div className="reconciliation-presets">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const today = todayIsoDate()
                setFrom(today)
                setTo(today)
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFrom(isoDateFromOffset(-6))
                setTo(todayIsoDate())
              }}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFrom(monthStartIsoDate())
                setTo(todayIsoDate())
              }}
            >
              This Month
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFrom('')
                setTo(todayIsoDate())
              }}
            >
              Clear From
            </button>
          </div>

          <div className="reconciliation-filters">
            <label className="field">
              <span>From</span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <small>{'\u00a0'}</small>
            </label>

            <label className="field">
              <span>To</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              <small>{'\u00a0'}</small>
            </label>

            <button type="button" onClick={handleExport} disabled={isExporting || summaryQuery.isFetching}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          <h3>Staff Users</h3>
          <p className="panel-note">Select one or more staff users to filter payment records.</p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Name</th>
                  <th>Staff ID</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {(staffUsersQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5}>No staff users found.</td>
                  </tr>
                )}

                {(staffUsersQuery.data ?? []).map((user, index) => {
                  const staffId = String(user.staffId ?? `staff-${index + 1}`)
                  const firstName = String(user.firstName ?? '').trim()
                  const lastName = String(user.lastName ?? '').trim()
                  const displayName = `${firstName} ${lastName}`.trim() || '-'
                  const isActive = user.isActive !== false
                  const checked = normalizedSelectedStaffIds.includes(staffId)
                  const lastLogin = user.lastLogin ? new Date(String(user.lastLogin)).toLocaleString() : '-'

                  return (
                    <tr key={staffId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedStaffIds((prev) => {
                              if (prev.includes(staffId)) {
                                return prev.filter((value) => value !== staffId)
                              }

                              return [...prev, staffId]
                            })
                          }}
                          aria-label={`Select ${staffId}`}
                        />
                      </td>
                      <td>{displayName}</td>
                      <td>{staffId}</td>
                      <td>{isActive ? 'Active' : 'Inactive'}</td>
                      <td>{lastLogin}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="panel-note">Staff payment filter: {selectedStaffLabel}</p>

          {staffUsersQuery.isError && <div className="error-banner">Unable to load staff list: {staffUsersQuery.error.message}</div>}

          {summaryQuery.isError && <div className="error-banner">{summaryQuery.error.message}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Staff Name</th>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Items</th>
                  <th>Gross Sales</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {(summaryQuery.data ?? []).length === 0 && !summaryQuery.isFetching && (
                  <tr>
                    <td colSpan={8}>No summary rows for this filter window.</td>
                  </tr>
                )}

                {(summaryQuery.data ?? []).map((row, index) => {
                  const section = String(row.section ?? '-').toUpperCase()
                  const date = String(row.date ?? '-')
                  const isDayRow = section === 'DAY'
                  const dayKey = `${date}-${index}`
                  const isExpanded = expandedDays.includes(dayKey)
                  const ordersCount = typeof row.ordersCount === 'number' ? row.ordersCount : '-'
                  const itemsCount = typeof row.itemsCount === 'number' ? row.itemsCount : '-'
                  const grossSales = typeof row.grossSales === 'number' ? row.grossSales : undefined
                  const rangeFrom = String(row.from ?? filters.from ?? '-')
                  const rangeTo = String(row.to ?? filters.to ?? '-')
                  const staffRaw =
                    typeof row.paymentReceivedBy === 'string' && row.paymentReceivedBy.trim().length > 0
                      ? row.paymentReceivedBy
                      : normalizedSelectedStaffIds.length > 0
                        ? normalizedSelectedStaffIds.join('|')
                        : ''

                  return (
                    <Fragment key={`${section}-${date}-${index}`}>
                      <tr>
                        <td>
                          <span className={section === 'TOTAL' ? 'status-badge status-completed' : 'status-badge'}>{section}</span>
                        </td>
                        <td>{formatStaffLabel(staffRaw)}</td>
                        <td>
                          {date}
                          {isDayRow && (
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                setExpandedDays((prev) =>
                                  prev.includes(dayKey) ? prev.filter((value) => value !== dayKey) : [...prev, dayKey],
                                )
                              }}
                            >
                              {isExpanded ? 'Hide details' : 'View details'}
                            </button>
                          )}
                        </td>
                        <td>{ordersCount}</td>
                        <td>{itemsCount}</td>
                        <td>{formatCurrency(grossSales)}</td>
                        <td>{rangeFrom}</td>
                        <td>{rangeTo}</td>
                      </tr>

                      {isDayRow && isExpanded && (
                        <tr>
                          <td colSpan={8}>
                            <div className="reconciliation-drilldown">
                              <div className="table-wrap">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Staff</th>
                                      <th>Orders</th>
                                      <th>Items</th>
                                      <th>Gross Sales</th>
                                      <th>Reservations</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(Array.isArray(row.byStaff) ? row.byStaff : []).length === 0 && (
                                      <tr>
                                        <td colSpan={5}>No by-staff details for this day.</td>
                                      </tr>
                                    )}

                                    {(Array.isArray(row.byStaff) ? row.byStaff : []).map((entry, entryIndex) => (
                                      <tr key={`${dayKey}-staff-${entryIndex}`}>
                                        <td>{formatByStaffRowName(entry)}</td>
                                        <td>{toSafeNumber(entry.ordersCount)}</td>
                                        <td>{toSafeNumber(entry.itemsCount)}</td>
                                        <td>{formatCurrency(entry.grossSales)}</td>
                                        <td>{renderReservationDetails(entry.reservations, 'No reservations')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'stock-overview' && (
        <>
          <p className="panel-note">Track book stock against completed sales across the current catalog.</p>

          <div className="reconciliation-actions">
            <button
              type="button"
              onClick={handleStockOverviewExport}
              disabled={isExportingStockOverview || stockOverviewQuery.isFetching}
            >
              {isExportingStockOverview ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {stockOverviewQuery.isError && <div className="error-banner">{stockOverviewQuery.error.message}</div>}

          <div className="report-stat-grid">
            <article className="report-stat-card">
              <span className="report-stat-label">Books</span>
              <strong>{toSafeNumber(stockOverviewQuery.data?.totals.booksCount)}</strong>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-label">Total Stock</span>
              <strong>{toSafeNumber(stockOverviewQuery.data?.totals.totalStock)}</strong>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-label">Sold</span>
              <strong>{toSafeNumber(stockOverviewQuery.data?.totals.stockSold)}</strong>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-label">Left</span>
              <strong>{toSafeNumber(stockOverviewQuery.data?.totals.stockLeft)}</strong>
            </article>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Total Stock</th>
                  <th>Sold</th>
                  <th>Left</th>
                </tr>
              </thead>
              <tbody>
                {(stockOverviewQuery.data?.books ?? []).length === 0 && !stockOverviewQuery.isFetching && (
                  <tr>
                    <td colSpan={6}>No stock overview rows available.</td>
                  </tr>
                )}

                {(stockOverviewQuery.data?.books ?? []).map((book, index) => {
                  const bookKey = String(book.bookId ?? `stock-overview-${index + 1}`)

                  return (
                    <tr key={bookKey}>
                      <td>{String(book.title ?? '-')}</td>
                      <td>{String(book.author ?? '-')}</td>
                      <td>{String(book.category ?? '-')}</td>
                      <td>{toSafeNumber(book.totalStock)}</td>
                      <td>{toSafeNumber(book.stockSold)}</td>
                      <td>{toSafeNumber(book.stockLeft)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
