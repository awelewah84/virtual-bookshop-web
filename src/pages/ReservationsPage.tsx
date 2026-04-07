import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { completeReservation, listCatalog, listReservationsByStatus, updateReservationAdmin } from '../lib/api'
import { formatCurrency } from '../lib/currency'
import { updateReservationAdminSchema, type UpdateReservationAdminSchema } from '../lib/schemas'
import type { Reservation, ReservationStatus } from '../types/api'

const RESERVATION_REFRESH_MS = 30_000
const RESERVATION_STATUS_OPTIONS: ReservationStatus[] = ['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAID']

function statusClassName(status: string): string {
  const normalized = status.toLowerCase()
  if (normalized === 'active') {
    return 'status-badge status-active'
  }
  if (normalized === 'paid' || normalized === 'completed') {
    return 'status-badge status-completed'
  }
  if (normalized === 'cancelled') {
    return 'status-badge status-cancelled'
  }
  if (normalized === 'expired') {
    return 'status-badge status-expired'
  }
  return 'status-badge'
}

function getExpiryText(expiresAtRaw: unknown): string {
  if (!expiresAtRaw) {
    return 'No expiry data'
  }

  const expiresAt = new Date(String(expiresAtRaw))
  if (Number.isNaN(expiresAt.getTime())) {
    return 'No expiry data'
  }

  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  if (diffMs <= 0) {
    return 'Expired'
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `Expires in ${hours}h ${minutes}m`
  }

  return `Expires in ${minutes}m`
}

export function ReservationsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>('ACTIVE')
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })
  const reservationsQuery = useQuery({
    queryKey: ['reservations', statusFilter],
    queryFn: () => listReservationsByStatus(statusFilter),
    refetchInterval: RESERVATION_REFRESH_MS,
    refetchIntervalInBackground: true,
  })
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const nextRefreshAt = reservationsQuery.dataUpdatedAt > 0 ? reservationsQuery.dataUpdatedAt + RESERVATION_REFRESH_MS : 0
  const countdownSeconds = Math.max(0, Math.ceil((nextRefreshAt - nowTick) / 1000))

  const titleByBookId = new Map(
    (catalogQuery.data ?? []).map((book) => {
      const id = String(book.bookId ?? book.id ?? '')
      return [id, String(book.title ?? 'Untitled')]
    }),
  )

  const editForm = useForm<UpdateReservationAdminSchema>({
    resolver: zodResolver(updateReservationAdminSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      reservationHours: 24,
      bookIds: [''],
    },
  })

  const editBookIds = useWatch({ control: editForm.control, name: 'bookIds' }) ?? ['']

  useEffect(() => {
    if (!editingReservation) {
      return
    }

    const ids = (editingReservation.items ?? []).map((item) => item.bookId).filter(Boolean)

    editForm.reset({
      customerName: String(editingReservation.customerName ?? ''),
      customerEmail: String(editingReservation.customerEmail ?? ''),
      reservationHours: 24,
      bookIds: ids.length > 0 ? ids : [''],
    })
  }, [editForm, editingReservation])

  const editMutation = useMutation({
    mutationFn: async (values: UpdateReservationAdminSchema) => {
      const reservationNo = String(editingReservation?.reservationNo ?? '')
      return updateReservationAdmin(reservationNo, values)
    },
    onSuccess: async () => {
      toast.success('Reservation updated.')
      setEditingReservation(null)
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const completeMutation = useMutation({
    mutationFn: completeReservation,
    onSuccess: async () => {
      toast.success('Payment handover recorded successfully.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="panel-grid">
      <section className="panel">
        <h2>Reservations</h2>
        <p className="panel-note">Track reservations, then record payment handover when customers collect books.</p>
        <p className="panel-note refresh-note">
          {reservationsQuery.isFetching
            ? 'Refreshing reservations...'
            : nextRefreshAt > 0
              ? `Auto-refresh in ${countdownSeconds}s`
              : 'Waiting for first sync...'}
        </p>

        <div className="reservation-actions">
          <Link className="button-link reservation-btn reservation-top-btn reservation-top-btn-active" to="/admin/reservations/new">
            Create New Reservation
          </Link>
          <Link className="button-link ghost-link reservation-btn reservation-top-btn" to="/reserve">
            Open Customer Booking Page
          </Link>
          <label className="field reservation-filter-field">
            <span>Status Filter</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ReservationStatus)}
              aria-label="Filter reservations by status"
            >
              {RESERVATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <small>{'\u00a0'}</small>
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>PaymentReceived By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(reservationsQuery.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={8}>No reservations found.</td>
                </tr>
              )}

              {(reservationsQuery.data ?? []).slice(0, 20).map((reservation, index) => {
                const reservationNo = String(reservation.reservationNo ?? `reservation-${index + 1}`)
                const customerName = String(reservation.customerName ?? '-')
                const status = String(reservation.status ?? 'Pending')
                const createdAt = reservation.createdAt ? new Date(String(reservation.createdAt)).toLocaleString() : '-'
                const expiryText = getExpiryText(reservation.expiresAt)
                const totalCost = formatCurrency(reservation.totalCost)
                const paymentReceivedBy = String(reservation.paymentReceivedBy ?? '-')
                const itemsSummary = (reservation.items ?? [])
                  .map((item) => {
                    const label = item.title ? String(item.title) : titleByBookId.get(item.bookId) ?? item.bookId
                    const itemCost = item.unitPrice === undefined ? '' : ` (${formatCurrency(item.unitPrice, '')})`
                    return `${label}${itemCost}`
                  })
                  .join(', ')

                const reservationNoText = String(reservation.reservationNo ?? '')
                const canEdit = status === 'ACTIVE'

                return (
                  <tr key={reservationNo}>
                    <td>{reservationNo}</td>
                    <td>
                      <strong>{customerName}</strong>
                      <small>{String(reservation.customerEmail ?? '-')}</small>
                    </td>
                    <td>{itemsSummary || '-'}</td>
                    <td>{totalCost}</td>
                    <td>
                      <span className={statusClassName(status)}>{status}</span>
                      <small className="expiry-note">{expiryText}</small>
                    </td>
                    <td>{paymentReceivedBy}</td>
                    <td>{createdAt}</td>
                    <td>
                      <div className="reservation-row-actions">
                        <button
                          type="button"
                          className="ghost reservation-btn"
                          onClick={() => setEditingReservation(reservation)}
                          disabled={!canEdit}
                          title={!canEdit ? 'Only active reservations can be edited before payment handover.' : undefined}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="reservation-btn"
                          onClick={() => completeMutation.mutate(reservationNoText)}
                          disabled={!canEdit || completeMutation.isPending}
                          title={!canEdit ? 'Payment handover can only be recorded for active reservations.' : undefined}
                        >
                          Record Payment Handover
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {editingReservation && (
          <div className="modal-backdrop" role="presentation" onClick={() => setEditingReservation(null)}>
            <section
              className="panel modal-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Edit reservation"
              onClick={(event) => event.stopPropagation()}
            >
              <h2>Edit Reservation</h2>
              <p className="panel-note">Update customer details, books, or hold duration for active reservation.</p>

              <form onSubmit={editForm.handleSubmit((values) => editMutation.mutate(values))}>
                <label className="field">
                  <span>Customer Name</span>
                  <input type="text" {...editForm.register('customerName')} />
                  <small>{editForm.formState.errors.customerName?.message ?? '\u00a0'}</small>
                </label>

                <label className="field">
                  <span>Customer Email</span>
                  <input type="email" {...editForm.register('customerEmail')} />
                  <small>{editForm.formState.errors.customerEmail?.message ?? '\u00a0'}</small>
                </label>

                <label className="field">
                  <span>Reservation Hours (optional)</span>
                  <input type="number" min={1} step="1" {...editForm.register('reservationHours', { valueAsNumber: true })} />
                  <small>{editForm.formState.errors.reservationHours?.message ?? '\u00a0'}</small>
                </label>

                <div className="line-items">
                  {editBookIds.map((_, index) => (
                    <div className="line-item" key={`edit-book-${index}`}>
                      <label className="field">
                        <span>Book</span>
                        <select {...editForm.register(`bookIds.${index}`)}>
                          <option value="">Select a book</option>
                          {(catalogQuery.data ?? []).map((book) => {
                            const id = String(book.bookId ?? book.id ?? '')
                            const title = String(book.title ?? 'Untitled')
                            return (
                              <option key={id} value={id}>
                                {title}
                              </option>
                            )
                          })}
                        </select>
                        <small>{editForm.formState.errors.bookIds?.[index]?.message ?? '\u00a0'}</small>
                      </label>

                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          if (editBookIds.length <= 1) {
                            return
                          }
                          editForm.setValue(
                            'bookIds',
                            editBookIds.filter((_, i) => i !== index),
                            { shouldValidate: true, shouldDirty: true },
                          )
                        }}
                        disabled={editBookIds.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    editForm.setValue('bookIds', [...editBookIds, ''], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  disabled={editBookIds.length >= 5}
                >
                  Add Another Book
                </button>

                <div className="reservation-actions">
                  <button type="submit" disabled={editMutation.isPending}>
                    {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" className="ghost" onClick={() => setEditingReservation(null)}>
                    Cancel
                  </button>
                </div>
                {editMutation.isError && <div className="error-banner">{editMutation.error.message}</div>}
              </form>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
