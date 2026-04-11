import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useToast } from '../hooks/useToast'
import { createReservation, listCatalog } from '../lib/api'
import { formatCurrency } from '../lib/currency'
import { createPublicReservationSchema, type CreatePublicReservationSchema } from '../lib/schemas'
import { BookThumbnail } from '../components/BookThumbnail'

const DEFAULT_CUSTOMER_RESERVATION_HOURS = 24

export function PublicReservePage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })

  const form = useForm<CreatePublicReservationSchema>({
    resolver: zodResolver(createPublicReservationSchema),
    defaultValues: { customerName: '', email: '', bookIds: [''], reservationHours: DEFAULT_CUSTOMER_RESERVATION_HOURS },
  })

  const selectedBookIds = useWatch({ control: form.control, name: 'bookIds' }) ?? ['']
  const [bookSearchTerms, setBookSearchTerms] = useState<string[]>([''])

  const catalogOptions = useMemo(
    () =>
      (catalogQuery.data ?? []).map((book) => {
        const id = String(book.bookId ?? book.id ?? '')
        const title = String(book.title ?? 'Untitled')
        const author = String(book.author ?? 'Unknown author')
        return {
          id,
          label: `${title} - ${author} (#${id})`,
        }
      }),
    [catalogQuery.data],
  )

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
    const matchedOption = catalogOptions.find((option) => option.label === rawValue)
    setBookIdAtIndex(index, matchedOption?.id ?? '')
  }

  const selectedBookId = selectedBookIds.find((id) => id.trim().length > 0) ?? ''
  const selectedBook = (catalogQuery.data ?? []).find((book) => String(book.bookId ?? book.id ?? '') === selectedBookId)

  const createMutation = useMutation({
    mutationFn: async (values: CreatePublicReservationSchema) =>
      createReservation({
        customerName: values.customerName,
        customerEmail: values.email,
        bookIds: values.bookIds,
        reservationHours: values.reservationHours ?? DEFAULT_CUSTOMER_RESERVATION_HOURS,
      }),
    onSuccess: async () => {
      form.reset({
        customerName: '',
        email: '',
        bookIds: [''],
        reservationHours: DEFAULT_CUSTOMER_RESERVATION_HOURS,
      })
      setBookSearchTerms([''])
      toast.success('Order submitted. Check your email for next steps.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="public-reserve-layout">
      <section className="panel">
        <h2>Create an Order</h2>
        <p className="panel-note">Enter your email, search for a book, and submit your order.</p>

        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="field">
            <span>Name</span>
            <input type="text" placeholder="Jane Doe" {...form.register('customerName')} />
            <small>{form.formState.errors.customerName?.message ?? '\u00a0'}</small>
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" {...form.register('email')} />
            <small>{form.formState.errors.email?.message ?? '\u00a0'}</small>
          </label>

          <div className="line-items">
            {selectedBookIds.map((_, index) => (
              <div className="line-item" key={`public-book-${index}`}>
                <label className="field">
                  <span>Book</span>
                  <input
                    type="text"
                    list="public-book-options"
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
                    if (selectedBookIds.length <= 1) {
                      return
                    }
                    form.setValue(
                      'bookIds',
                      selectedBookIds.filter((_, i) => i !== index),
                      { shouldValidate: true, shouldDirty: true },
                    )
                    setBookSearchTerms((previous) => previous.filter((_, i) => i !== index))
                  }}
                  disabled={selectedBookIds.length === 1}
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
              form.setValue('bookIds', [...selectedBookIds, ''], {
                shouldValidate: true,
                shouldDirty: true,
              })
              setBookSearchTerms((previous) => [...previous, ''])
            }}
            disabled={selectedBookIds.length >= 5}
          >
            Add Another Book
          </button>

          <datalist id="public-book-options">
            {catalogOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>

          <label className="field">
            <span>Order Hold Hours (optional)</span>
            <input
              type="number"
              min={1}
              step="1"
              {...form.register('reservationHours', {
                setValueAs: (value) => {
                  if (value === '' || value === null || value === undefined) {
                    return undefined
                  }

                  const parsed = Number(value)
                  return Number.isFinite(parsed) ? parsed : undefined
                },
              })}
            />
            <small>
              {form.formState.errors.reservationHours?.message ??
                `Leave blank for default ${DEFAULT_CUSTOMER_RESERVATION_HOURS}h.`}
            </small>
          </label>

          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Place Order'}
          </button>
          {createMutation.isSuccess && <div className="success-banner">Order sent successfully.</div>}
          {createMutation.isError && <div className="error-banner">{createMutation.error.message}</div>}
        </form>
      </section>

      <section className="panel">
        <h2>Book Options</h2>
        <p className="panel-note">Preview different books with image and available quantity.</p>

        {selectedBook && (
          <article className="selected-book-panel">
            <BookThumbnail
              title={String(selectedBook.title ?? 'Untitled Book')}
              thumbnailUrl={selectedBook.thumbnailUrl}
              imageClassName="selected-book-option-thumb"
              fallbackClassName="fallback-thumb-selected-option"
              maxTitleLength={34}
            />
            <div>
              <h3>{String(selectedBook.title ?? 'Untitled')}</h3>
              <p>{String(selectedBook.author ?? 'Unknown author')}</p>
              <p>In stock: {String(selectedBook.stock ?? 0)}</p>
              <p>Price: {formatCurrency(selectedBook.price)}</p>
            </div>
          </article>
        )}

        <div className="book-side-grid">
          {(catalogQuery.data ?? []).slice(0, 10).map((book, index) => {
            const id = String(book.bookId ?? book.id ?? `book-${index}`)
            const title = String(book.title ?? 'Untitled')
            const author = String(book.author ?? 'Unknown author')
            const stock = Number(book.stock ?? 0)

            return (
              <article className="book-side-card" key={id}>
                <BookThumbnail
                  title={title}
                  thumbnailUrl={book.thumbnailUrl}
                  imageClassName="book-side-thumb"
                  fallbackClassName="fallback-thumb-side"
                  maxTitleLength={16}
                />
                <div>
                  <strong>{title}</strong>
                  <small>{author}</small>
                  <small>Qty: {stock}</small>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
