import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { useToast } from '../hooks/useToast'
import { createReservation, listCatalog } from '../lib/api'
import { formatCurrency } from '../lib/currency'
import { createPublicReservationSchema, type CreatePublicReservationSchema } from '../lib/schemas'
import { BookThumbnail } from '../components/BookThumbnail'

export function PublicReservePage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })

  const form = useForm<CreatePublicReservationSchema>({
    resolver: zodResolver(createPublicReservationSchema),
    defaultValues: { customerName: '', email: '', bookIds: [''], reservationHours: 24 },
  })

  const selectedBookIds = useWatch({ control: form.control, name: 'bookIds' }) ?? ['']
  const selectedBookId = selectedBookIds.find((id) => id.trim().length > 0) ?? ''
  const selectedBook = (catalogQuery.data ?? []).find((book) => String(book.bookId ?? book.id ?? '') === selectedBookId)

  const createMutation = useMutation({
    mutationFn: async (values: CreatePublicReservationSchema) =>
      createReservation({
        customerName: values.customerName,
        customerEmail: values.email,
        bookIds: values.bookIds,
        reservationHours: values.reservationHours,
      }),
    onSuccess: async () => {
      form.reset({ customerName: '', email: '', bookIds: [''], reservationHours: 24 })
      toast.success('Reservation submitted. Check your email for next steps.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="public-reserve-layout">
      <section className="panel">
        <h2>Reserve a Book</h2>
        <p className="panel-note">Enter your email, pick a book, and submit your reservation.</p>

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
                    if (selectedBookIds.length <= 1) {
                      return
                    }
                    form.setValue(
                      'bookIds',
                      selectedBookIds.filter((_, i) => i !== index),
                      { shouldValidate: true, shouldDirty: true },
                    )
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
            onClick={() =>
              form.setValue('bookIds', [...selectedBookIds, ''], {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            disabled={selectedBookIds.length >= 5}
          >
            Add Another Book
          </button>

          <label className="field">
            <span>Reservation Hours (optional)</span>
            <input type="number" min={1} step="1" {...form.register('reservationHours', { valueAsNumber: true })} />
            <small>{form.formState.errors.reservationHours?.message ?? '\u00a0'}</small>
          </label>

          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Reserve Books'}
          </button>
          {createMutation.isSuccess && <div className="success-banner">Reservation sent successfully.</div>}
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
