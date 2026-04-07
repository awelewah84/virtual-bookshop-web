import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { listCatalog } from '../lib/api'
import { BookThumbnail } from '../components/BookThumbnail'
import { formatCurrency } from '../lib/currency'

export function PublicCatalogPage() {
  const [query, setQuery] = useState('')
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })

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

  return (
    <section className="panel">
      <h2>Browse Books</h2>
      <p className="panel-note">Browse available books by card view. See icon, available quantity, and price at a glance.</p>

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

          return (
            <article className={`public-book-card${isOutOfStock ? ' out-of-stock-card' : ''}`} key={id}>
              {isOutOfStock && <div className="out-of-stock-badge">Out Of Stock</div>}
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
  )
}
