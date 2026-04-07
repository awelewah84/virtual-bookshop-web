import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportSalesSummaryCsv, getSalesSummary, listStaffUsers } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { formatCurrency } from '../lib/currency'
import type { SalesSummaryRow } from '../types/api'

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

function mergeSalesSummaryRows(
  groupedRows: SalesSummaryRow[][],
  from: string | undefined,
  to: string | undefined,
): SalesSummaryRow[] {
  let totalOrders = 0
  let totalItems = 0
  let totalGross = 0
  const byDay = new Map<string, { ordersCount: number; itemsCount: number; grossSales: number }>()

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

      const current = byDay.get(date) ?? { ordersCount: 0, itemsCount: 0, grossSales: 0 }
      current.ordersCount += toSafeNumber(row.ordersCount)
      current.itemsCount += toSafeNumber(row.itemsCount)
      current.grossSales += toSafeNumber(row.grossSales)
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
  }

  const dayRows = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      section: 'DAY',
      date,
      ordersCount: values.ordersCount,
      itemsCount: values.itemsCount,
      grossSales: Number(values.grossSales.toFixed(2)),
      from: '',
      to: '',
    }))

  return [totalRow, ...dayRows]
}

function toCsvValue(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function buildMultiStaffCsv(
  rows: SalesSummaryRow[],
  from: string | undefined,
  to: string | undefined,
  staffIds: string[],
): string {
  const paidByValue = staffIds.join('|')
  const lines: string[] = []
  lines.push('section,date,ordersCount,itemsCount,grossSales,from,to,paymentReceivedBy')

  for (const row of rows) {
    const section = String(row.section ?? '')
    const date = String(row.date ?? '')
    const ordersCount = toSafeNumber(row.ordersCount)
    const itemsCount = toSafeNumber(row.itemsCount)
    const grossSales = toSafeNumber(row.grossSales).toFixed(2)
    const rowFrom = section.toUpperCase() === 'TOTAL' ? from ?? '' : ''
    const rowTo = section.toUpperCase() === 'TOTAL' ? to ?? '' : ''

    lines.push(
      [section, date, ordersCount, itemsCount, grossSales, rowFrom, rowTo, paidByValue]
        .map((value) => toCsvValue(value))
        .join(','),
    )
  }

  return `${lines.join('\n')}\n`
}

export function AdminReconciliationPage() {
  const toast = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayIsoDate())
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const staffUsersQuery = useQuery({ queryKey: ['staff-users'], queryFn: listStaffUsers })

  const normalizedSelectedStaffIds = useMemo(
    () => [...new Set(selectedStaffIds.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [selectedStaffIds],
  )

  const selectedStaffLabel = normalizedSelectedStaffIds.length > 0 ? normalizedSelectedStaffIds.join(', ') : 'All staff'

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

      return mergeSalesSummaryRows(groupedRows, filters.from, filters.to)
    },
  })

  async function handleExport(): Promise<void> {
    try {
      setIsExporting(true)
      const blob =
        normalizedSelectedStaffIds.length <= 1
          ? await exportSalesSummaryCsv(filters)
          : new Blob([buildMultiStaffCsv(summaryQuery.data ?? [], filters.from, filters.to, normalizedSelectedStaffIds)], {
              type: 'text/csv;charset=utf-8',
            })
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

  return (
    <section className="panel">
      <h2>Admin Reconciliation</h2>
      <p className="panel-note">Review sales totals and daily aggregates, then export CSV for finance reconciliation.</p>

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

        <label className="field">
          <span>Payment Received By (Staff)</span>
          <select
            multiple
            value={normalizedSelectedStaffIds}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value)
              setSelectedStaffIds(values)
            }}
            aria-label="Filter by staff"
            size={Math.min(6, Math.max(3, (staffUsersQuery.data ?? []).length))}
          >
            {(staffUsersQuery.data ?? []).map((user, index) => {
              const staffId = String(user.staffId ?? `staff-${index + 1}`)
              const status = user.isActive === false ? ' (Inactive)' : ''
              return (
                <option key={staffId} value={staffId}>
                  {staffId}
                  {status}
                </option>
              )
            })}
          </select>
          <small>{'\u00a0'}</small>
        </label>

        <button type="button" onClick={handleExport} disabled={isExporting || summaryQuery.isFetching}>
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <p className="panel-note">Hold Ctrl/Cmd to select multiple staff members.</p>

      <p className="panel-note">
        Staff payment filter: {selectedStaffLabel}
      </p>

      {staffUsersQuery.isError && <div className="error-banner">Unable to load staff list: {staffUsersQuery.error.message}</div>}

      {summaryQuery.isError && <div className="error-banner">{summaryQuery.error.message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Section</th>
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
                <td colSpan={7}>No summary rows for this filter window.</td>
              </tr>
            )}

            {(summaryQuery.data ?? []).map((row, index) => {
              const section = String(row.section ?? '-').toUpperCase()
              const date = String(row.date ?? '-')
              const ordersCount = typeof row.ordersCount === 'number' ? row.ordersCount : '-'
              const itemsCount = typeof row.itemsCount === 'number' ? row.itemsCount : '-'
              const grossSales = typeof row.grossSales === 'number' ? row.grossSales : undefined
              const rangeFrom = String(row.from ?? filters.from ?? '-')
              const rangeTo = String(row.to ?? filters.to ?? '-')

              return (
                <tr key={`${section}-${date}-${index}`}>
                  <td>
                    <span className={section === 'TOTAL' ? 'status-badge status-completed' : 'status-badge'}>{section}</span>
                  </td>
                  <td>{date}</td>
                  <td>{ordersCount}</td>
                  <td>{itemsCount}</td>
                  <td>{formatCurrency(grossSales)}</td>
                  <td>{rangeFrom}</td>
                  <td>{rangeTo}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
