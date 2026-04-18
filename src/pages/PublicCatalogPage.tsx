import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { createReservation, listCatalog } from '../lib/api'
import { BookThumbnail } from '../components/BookThumbnail'
import { formatCurrency } from '../lib/currency'
import { useToast } from '../hooks/useToast'
import { createPublicReservationSchema } from '../lib/schemas'

const MAX_BOOKS_PER_ORDER = 5
const DEFAULT_CUSTOMER_RESERVATION_HOURS = 24

export function PublicCatalogPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([])
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })

  const createMutation = useMutation({
    mutationFn: async (payload: { customerName: string; email?: string; bookIds: string[] }) =>
      createReservation({
        customerName: payload.customerName,
        customerEmail: payload.email?.trim() ? payload.email.trim() : undefined,
        bookIds: payload.bookIds,
        reservationHours: DEFAULT_CUSTOMER_RESERVATION_HOURS,
      }),
    onSuccess: async () => {
      setCustomerName('')
      setEmail('')
      setSelectedBookIds([])
      toast.success('Order submitted successfully.')
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return catalogQuery.data ?? []
    }

    return (catalogQuery.data ?? []).filter((book) => {
      const title = String(book.title ?? '').toLowerCase()
      const author = String(book.author ?? '').toLowerCase()
      return title.includes(q) || author.includes(q)
    })
  }, [catalogQuery.data, query])

  const selectedBooks = useMemo(() => {
    const catalog = catalogQuery.data ?? []
    return selectedBookIds
      .map((bookId) =>
        catalog.find((book) => {
          const id = String(book.bookId ?? book.id ?? '')
          return id === bookId
        }),
      )
      .filter((book): book is NonNullable<typeof book> => Boolean(book))
  }, [catalogQuery.data, selectedBookIds])

  const addBookToOrder = (bookId: string, stock: number) => {
    if (stock <= 0) {
      toast.error('This book is out of stock.')
      return
    }

    if (selectedBookIds.includes(bookId)) {
      toast.info('This book is already in your order.')
      return
    }

    if (selectedBookIds.length >= MAX_BOOKS_PER_ORDER) {
      toast.error(`Maximum ${MAX_BOOKS_PER_ORDER} books per order.`)
      return
    }

    setSelectedBookIds((previous) => [...previous, bookId])
  }

  const removeBookFromOrder = (bookId: string) => {
    setSelectedBookIds((previous) => previous.filter((id) => id !== bookId))
  }

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = createPublicReservationSchema.safeParse({
      customerName: customerName.trim(),
      email: email.trim(),
      bookIds: selectedBookIds,
      reservationHours: DEFAULT_CUSTOMER_RESERVATION_HOURS,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      toast.error(issue?.message ?? 'Please complete all required fields.')
      return
    }

    createMutation.mutate(parsed.data)
  }

  return (
    <div className="public-catalog-order-layout">
      <section className="panel">
        <h2>Book Collection</h2>
        <p className="panel-note">Tap the plus icon to add books to your order.</p>

        <div className="catalog-public-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or author"
            aria-label="Search books"
          />
          <button type="button" className="ghost" onClick={() => catalogQuery.refetch()} disabled={catalogQuery.isFetching}>
            {catalogQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {catalogQuery.isError && <div className="error-banner">Catalog load failed: {catalogQuery.error.message}</div>}

        <div className="public-cards-grid">
          {filteredBooks.length === 0 && <p className="panel-note">No books match your search right now.</p>}

          {filteredBooks.map((book, index) => {
            const id = String(book.bookId ?? book.id ?? `book-${index}`)
            const title = String(book.title ?? 'Untitled')
            const author = String(book.author ?? 'Unknown author')
            const qty = typeof book.stock === 'number' ? book.stock : 0
            const isOutOfStock = qty <= 0
            const price = formatCurrency(book.price, 'Price unavailable')
            const thumbnailUrl = typeof book.thumbnailUrl === 'string' ? book.thumbnailUrl : ''
            const isSelected = selectedBookIds.includes(id)

            return (
              <article className={`public-book-card${isOutOfStock ? ' out-of-stock-card' : ''}`} key={id}>
                <div className="public-book-card-head">
                  {isOutOfStock ? <div className="out-of-stock-badge">Out Of Stock</div> : <span className="stock-ready-pill">In Stock</span>}
                  <button
                    type="button"
                    className="book-add-icon"
                    onClick={() => addBookToOrder(id, qty)}
                    disabled={isOutOfStock || isSelected || selectedBookIds.length >= MAX_BOOKS_PER_ORDER}
                    aria-label={`Add ${title} to order`}
                    title={isSelected ? 'Already added' : 'Add to order'}
                  >
                    +
                  </button>
                </div>

                <BookThumbnail
                  title={title}
                  thumbnailUrl={thumbnailUrl}
                  imageClassName="public-book-thumb"
                  fallbackClassName="fallback-thumb-public"
                  maxTitleLength={42}
                />
                <h3>{title}</h3>
                <p>{author}</p>
                <dl>
                  <div>
                    <dt>Quantity</dt>
                    <dd>{qty}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{price}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Your Order</h2>
        <p className="panel-note">Enter your details, review selected books, and place order.</p>

        <form onSubmit={submitOrder}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              placeholder="Jane Doe"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <small>{'\u00a0'}</small>
          </label>

          <label className="field">
            <span>Email (optional)</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <small>{'\u00a0'}</small>
          </label>

          <div className="selected-order-box">
            <div className="selected-order-header">
              <strong>Selected Books</strong>
              <span>{selectedBookIds.length}/{MAX_BOOKS_PER_ORDER}</span>
            </div>

            <div className="selected-order-scroll">
              {selectedBooks.length === 0 && <p className="panel-note">Use the + icon on a book to add it here.</p>}

              {selectedBooks.map((book, index) => {
                const id = String(book.bookId ?? book.id ?? `selected-${index}`)
                const title = String(book.title ?? 'Untitled')
                const author = String(book.author ?? 'Unknown author')
                const price = formatCurrency(book.price, 'Price unavailable')

                return (
                  <article className="selected-order-item" key={id}>
                    <div>
                      <strong>{title}</strong>
                      <small>{author}</small>
                      <small>{price}</small>
                    </div>
                    <button type="button" className="ghost" onClick={() => removeBookFromOrder(id)}>
                      Remove
                    </button>
                  </article>
                )
              })}
            </div>
          </div>

          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Place Order'}
          </button>
          {createMutation.isSuccess && <div className="success-banner">Order sent successfully.</div>}
          {createMutation.isError && <div className="error-banner">{createMutation.error.message}</div>}
        </form>
      </section>
    </div>
  )
}
