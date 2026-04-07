import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { createReservation, listCatalog } from '../lib/api'
import { createReservationSchema, type CreateReservationSchema } from '../lib/schemas'

export function ReservationCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })

  const form = useForm<CreateReservationSchema>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      reservationHours: 24,
      bookIds: [''],
    },
  })

  const bookIds = useWatch({ control: form.control, name: 'bookIds' }) ?? ['']

  const createMutation = useMutation({
    mutationFn: createReservation,
    onSuccess: async () => {
      form.reset({ customerName: '', customerEmail: '', reservationHours: 24, bookIds: [''] })
      toast.success('Reservation created successfully.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
      navigate('/admin/reservations')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <section className="panel">
      <h2>Create Reservation</h2>
      <p className="panel-note">Internal reservation form with multiple line items.</p>

      <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
        <label className="field">
          <span>Customer Name</span>
          <input type="text" placeholder="Jane Doe" {...form.register('customerName')} />
          <small>{form.formState.errors.customerName?.message ?? '\u00a0'}</small>
        </label>

        <label className="field">
          <span>Customer Email</span>
          <input type="email" placeholder="jane@example.com" {...form.register('customerEmail')} />
          <small>{form.formState.errors.customerEmail?.message ?? '\u00a0'}</small>
        </label>

        <label className="field">
          <span>Reservation Hours (optional)</span>
          <input type="number" min={1} step="1" {...form.register('reservationHours', { valueAsNumber: true })} />
          <small>{form.formState.errors.reservationHours?.message ?? '\u00a0'}</small>
        </label>

        <div className="line-items">
          {bookIds.map((_, index) => (
            <div className="line-item" key={`book-${index}`}>
              <label className="field">
                <span>Book</span>
                <select {...form.register(`bookIds.${index}`)}>
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
                <small>{form.formState.errors.bookIds?.[index]?.message ?? '\u00a0'}</small>
              </label>

              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (bookIds.length <= 1) {
                    return
                  }
                  form.setValue(
                    'bookIds',
                    bookIds.filter((_, i) => i !== index),
                    { shouldValidate: true, shouldDirty: true },
                  )
                }}
                disabled={bookIds.length === 1}
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
            form.setValue('bookIds', [...bookIds, ''], {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          disabled={bookIds.length >= 5}
        >
          Add Another Book
        </button>

        <div className="reservation-actions">
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Create Reservation'}
          </button>
          <Link className="button-link ghost-link" to="/admin/reservations">
            Back to List
          </Link>
        </div>

        {createMutation.isError && <div className="error-banner">{createMutation.error.message}</div>}
      </form>
    </section>
  )
}
