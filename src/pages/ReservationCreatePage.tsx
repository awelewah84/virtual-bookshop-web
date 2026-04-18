import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
  const [bookSearchTerms, setBookSearchTerms] = useState<string[]>([''])

  const catalogOptions = useMemo(
    () =>
      (catalogQuery.data ?? []).map((book) => {
        const id = String(book.bookId ?? book.id ?? '')
        const title = String(book.title ?? 'Untitled')
        const author = String(book.author ?? 'Unknown author')
        return {
          id,
          title,
          label: `${title} - ${author} (#${id})`,
        }
      }),
    [catalogQuery.data],
  )

  const resolveBookId = (rawValue: string): string => {
    const value = rawValue.trim()
    if (!value) {
      return ''
    }

    const byLabel = catalogOptions.find((option) => option.label === value)
    if (byLabel) {
      return byLabel.id
    }

    const idMatch = value.match(/\(#([^\)]+)\)$/)
    if (idMatch) {
      return idMatch[1].trim()
    }

    const byId = catalogOptions.find((option) => option.id === value)
    if (byId) {
      return byId.id
    }

    const normalized = value.toLowerCase()
    const titleMatches = catalogOptions.filter((option) => option.title.toLowerCase() === normalized)
    if (titleMatches.length === 1) {
      return titleMatches[0].id
    }

    return ''
  }

  const getSearchTerm = (index: number) => bookSearchTerms[index] ?? ''

  const setSearchTerm = (index: number, value: string) => {
    setBookSearchTerms((previous) => {
      const next = [...previous]
      while (next.length <= index) {
        next.push('')
      }
      next[index] = value
      return next
    })
  }

  const setBookIdAtIndex = (index: number, value: string) => {
    form.setValue(`bookIds.${index}`, value, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  const handleBookSearchChange = (index: number, rawValue: string) => {
    setSearchTerm(index, rawValue)
    setBookIdAtIndex(index, resolveBookId(rawValue))
  }

  const createMutation = useMutation({
    mutationFn: createReservation,
    onSuccess: async () => {
      form.reset({ customerName: '', customerEmail: '', reservationHours: 24, bookIds: [''] })
      setBookSearchTerms([''])
      toast.success('Order created successfully.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
      navigate('/admin/reservations')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <section className="panel">
      <h2>Create Order</h2>
      <p className="panel-note">Internal order form with multiple line items.</p>

      <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
        <label className="field">
          <span>Customer Name</span>
          <input type="text" placeholder="Jane Doe" {...form.register('customerName')} />
          <small>{form.formState.errors.customerName?.message ?? '\u00a0'}</small>
        </label>

        <label className="field">
          <span>Customer Email (optional)</span>
          <input type="email" placeholder="jane@example.com" {...form.register('customerEmail')} />
          <small>{form.formState.errors.customerEmail?.message ?? '\u00a0'}</small>
        </label>

        <label className="field">
          <span>Order Hold Hours (optional)</span>
          <input type="number" min={1} step="1" {...form.register('reservationHours', { valueAsNumber: true })} />
          <small>{form.formState.errors.reservationHours?.message ?? '\u00a0'}</small>
        </label>

        <div className="line-items">
          {bookIds.map((_, index) => (
            <div className="line-item" key={`book-${index}`}>
              <label className="field">
                <span>Book</span>
                <input
                  type="text"
                  list="admin-order-book-options"
                  placeholder="Search by title or author"
                  value={getSearchTerm(index)}
                  onChange={(event) => handleBookSearchChange(index, event.target.value)}
                />
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
                  setBookSearchTerms((previous) => previous.filter((_, i) => i !== index))
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
          onClick={() => {
            form.setValue('bookIds', [...bookIds, ''], {
              shouldValidate: true,
              shouldDirty: true,
            })
            setBookSearchTerms((previous) => [...previous, ''])
          }}
          disabled={bookIds.length >= 5}
        >
          Add Another Book
        </button>

        <datalist id="admin-order-book-options">
          {catalogOptions.map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>

        <div className="reservation-actions">
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Create Order'}
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
