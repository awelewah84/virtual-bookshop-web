import { useMemo, useState } from 'react'
import type { Book } from '../types/api'
import { BookThumbnail } from './BookThumbnail'
import { formatCurrency } from '../lib/currency'

type SortField = 'title' | 'author' | 'stock' | 'price'

type Props = {
  books: Book[]
  selectedBookId?: string | null
  onSelectBook?: (bookId: string) => void
}

function toValue(book: Book, field: SortField): string | number {
  if (field === 'stock') {
    return typeof book.stock === 'number' ? book.stock : 0
  }

  if (field === 'price') {
    return typeof book.price === 'number' ? book.price : 0
  }

  return String(book[field] ?? '')
}

export function BookTable({ books, selectedBookId, onSelectBook }: Props) {
  const [query, setQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('title')
  const [descending, setDescending] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const subset = q
      ? books.filter((book) => {
          const title = String(book.title ?? '').toLowerCase()
          const author = String(book.author ?? '').toLowerCase()
          const id = String(book.bookId ?? book.id ?? '').toLowerCase()
          return title.includes(q) || author.includes(q) || id.includes(q)
        })
      : books

    const sorted = [...subset].sort((a, b) => {
      const left = toValue(a, sortField)
      const right = toValue(b, sortField)

      if (typeof left === 'number' && typeof right === 'number') {
        return left - right
      }

      return String(left).localeCompare(String(right))
    })

    return descending ? sorted.reverse() : sorted
  }, [books, descending, query, sortField])

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Catalog Inventory</h2>
        <p className="panel-note">Search, filter, and sort current books.</p>
      </div>

      <div className="toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, author, or ID"
          aria-label="Search catalog"
        />

        <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="Sort field">
          <option value="title">Sort: Title</option>
          <option value="author">Sort: Author</option>
          <option value="stock">Sort: Stock</option>
          <option value="price">Sort: Price</option>
        </select>

        <button type="button" onClick={() => setDescending((value) => !value)}>
          {descending ? 'Descending' : 'Ascending'}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>Identifier</th>
              <th>Stock</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4}>No books match your filter.</td>
              </tr>
            )}

            {filtered.map((book, index) => {
              const id = String(book.bookId ?? book.id ?? `book-${index}`)
              const title = String(book.title ?? 'Untitled')
              const author = String(book.author ?? 'Unknown author')
              const stock = typeof book.stock === 'number' ? book.stock : '-'
              const price = formatCurrency(book.price)
              const thumbnailUrl = typeof book.thumbnailUrl === 'string' ? book.thumbnailUrl : ''
              const isSelected = selectedBookId === id

              return (
                <tr
                  key={id}
                  className={onSelectBook ? `clickable-row${isSelected ? ' selected-row' : ''}` : undefined}
                  onClick={onSelectBook ? () => onSelectBook(id) : undefined}
                  onKeyDown={
                    onSelectBook
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelectBook(id)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onSelectBook ? 0 : undefined}
                  aria-selected={onSelectBook ? isSelected : undefined}
                >
                  <td>
                    <div className="book-cell">
                      <BookThumbnail
                        title={title}
                        thumbnailUrl={thumbnailUrl}
                        imageClassName="book-table-thumb"
                        fallbackClassName="fallback-thumb-table"
                        maxTitleLength={16}
                      />
                      <div>
                        <strong>{title}</strong>
                        <small>{author}</small>
                      </div>
                    </div>
                  </td>
                  <td>{id}</td>
                  <td>{stock}</td>
                  <td>{price}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
