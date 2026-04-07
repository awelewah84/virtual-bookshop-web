import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '../hooks/useToast'
import { createBook, importCatalogFromExcel, listCatalog, updateBook, updateBookStock } from '../lib/api'
import { formatCurrency } from '../lib/currency'
import { createBookSchema, type CreateBookSchema } from '../lib/schemas'
import { BookTable } from '../components/BookTable'
import { BookThumbnail } from '../components/BookThumbnail'

const bookFieldMeta: Array<{ name: keyof CreateBookSchema; label: string; type: string }> = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'author', label: 'Author', type: 'text' },
  { name: 'price', label: 'Price', type: 'number' },
  { name: 'stock', label: 'Initial Stock', type: 'number' },
]

export function CatalogPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [stockDraft, setStockDraft] = useState<number>(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createThumbnail, setCreateThumbnail] = useState<File | null>(null)
  const [updateThumbnail, setUpdateThumbnail] = useState<File | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)

  const selectedBook = useMemo(() => {
    if (!selectedBookId) {
      return null
    }

    return (catalogQuery.data ?? []).find((book) => {
      const id = String(book.bookId ?? book.id ?? '')
      return id === selectedBookId
    })
  }, [catalogQuery.data, selectedBookId])

  const form = useForm<CreateBookSchema>({
    resolver: zodResolver(createBookSchema),
    defaultValues: {
      title: '',
      author: '',
      price: 18.99,
      stock: 10,
    },
  })

  const createBookMutation = useMutation({
    mutationFn: createBook,
    onSuccess: async () => {
      form.reset()
      setCreateThumbnail(null)
      setIsCreateOpen(false)
      toast.success('Book created successfully.')
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateStockMutation = useMutation({
    mutationFn: async (payload: { bookId: string; stock: number }) => updateBookStock(payload.bookId, { stock: payload.stock }),
    onSuccess: async () => {
      toast.success('Book stock updated.')
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateThumbnailMutation = useMutation({
    mutationFn: async (payload: { bookId: string; thumbnail: File }) => updateBook(payload.bookId, { thumbnail: payload.thumbnail }),
    onSuccess: async () => {
      setUpdateThumbnail(null)
      toast.success('Thumbnail uploaded successfully.')
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const importCatalogMutation = useMutation({
    mutationFn: async (file: File) => importCatalogFromExcel(file),
    onSuccess: async (result) => {
      const imported = typeof result.imported === 'number' ? result.imported : 0
      const updated = typeof result.updated === 'number' ? result.updated : 0
      toast.success(`Excel import complete. Imported: ${imported}, Updated: ${updated}.`)
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const selectedId = selectedBook ? String(selectedBook.bookId ?? selectedBook.id ?? '') : ''

  const onSelectBook = (bookId: string) => {
    setSelectedBookId(bookId)

    const matchedBook = (catalogQuery.data ?? []).find((book) => {
      const id = String(book.bookId ?? book.id ?? '')
      return id === bookId
    })

    setStockDraft(typeof matchedBook?.stock === 'number' ? matchedBook.stock : 0)
    setUpdateThumbnail(null)
  }

  return (
    <div className="catalog-layout">
      {catalogQuery.isError && <div className="error-banner">Catalog load failed: {catalogQuery.error.message}</div>}

      <BookTable books={catalogQuery.data ?? []} selectedBookId={selectedBookId} onSelectBook={onSelectBook} />

      <section className="panel">
        <div className="catalog-detail-header">
          <div>
            <h2>Book Details</h2>
            <p className="panel-note">Click any listing to inspect details and update stock.</p>
          </div>
          <div className="catalog-actions">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }

                importCatalogMutation.mutate(file)
                event.target.value = ''
              }}
              hidden
            />

            <button
              type="button"
              className="ghost"
              onClick={() => excelInputRef.current?.click()}
              disabled={importCatalogMutation.isPending}
            >
              {importCatalogMutation.isPending ? 'Uploading Excel...' : 'Upload Stock (Excel)'}
            </button>

            <button type="button" onClick={() => setIsCreateOpen(true)}>
              Create Book
            </button>
          </div>
        </div>

        {!selectedBook && <p>No book selected yet.</p>}

        {selectedBook && (
          <>
            <BookThumbnail
              title={String(selectedBook.title ?? 'Untitled Book')}
              thumbnailUrl={selectedBook.thumbnailUrl}
              imageClassName="selected-book-thumb"
              fallbackClassName="fallback-thumb-selected"
              maxTitleLength={68}
            />

            <dl className="detail-list">
              <div>
                <dt>Title</dt>
                <dd>{String(selectedBook.title ?? 'Untitled')}</dd>
              </div>
              <div>
                <dt>Author</dt>
                <dd>{String(selectedBook.author ?? 'Unknown')}</dd>
              </div>
              <div>
                <dt>Book ID</dt>
                <dd className="detail-id-value">{selectedId}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatCurrency(selectedBook.price)}</dd>
              </div>
              <div>
                <dt>Stock</dt>
                <dd>{typeof selectedBook.stock === 'number' ? selectedBook.stock : '-'}</dd>
              </div>
            </dl>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!selectedId) {
                  return
                }

                updateStockMutation.mutate({ bookId: selectedId, stock: stockDraft })
              }}
            >
              <label className="field">
                <span>Update Stock</span>
                <input
                  type="number"
                  min={0}
                  value={stockDraft}
                  onChange={(event) => setStockDraft(Number(event.target.value))}
                />
                <small>&nbsp;</small>
              </label>

              <button type="submit" disabled={updateStockMutation.isPending}>
                {updateStockMutation.isPending ? 'Updating...' : 'Update'}
              </button>

              {updateStockMutation.isSuccess && <div className="success-banner">Stock updated successfully.</div>}
              {updateStockMutation.isError && <div className="error-banner">{updateStockMutation.error.message}</div>}
            </form>

            <form
              className="catalog-thumbnail-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!selectedId || !updateThumbnail) {
                  return
                }

                updateThumbnailMutation.mutate({ bookId: selectedId, thumbnail: updateThumbnail })
              }}
            >
              <label className="field">
                <span>Upload Thumbnail</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setUpdateThumbnail(event.target.files?.[0] ?? null)}
                />
                <small>{updateThumbnail ? updateThumbnail.name : '\u00a0'}</small>
              </label>

              <button type="submit" disabled={updateThumbnailMutation.isPending || !updateThumbnail}>
                {updateThumbnailMutation.isPending ? 'Uploading...' : 'Upload Thumbnail'}
              </button>

              {updateThumbnailMutation.isError && <div className="error-banner">{updateThumbnailMutation.error.message}</div>}
            </form>
          </>
        )}
      </section>

      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCreateOpen(false)}>
          <section
            className="panel modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Create book"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="catalog-detail-header">
              <div>
                <h2>Add New Book</h2>
                <p className="panel-note">Schema-validated form aligned to the catalog create payload.</p>
              </div>
              <button type="button" className="ghost" onClick={() => setIsCreateOpen(false)}>
                Close
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit((values) =>
                createBookMutation.mutate({
                  ...values,
                  thumbnail: createThumbnail,
                }),
              )}
            >
              {bookFieldMeta.map((field) => (
                <label key={field.name} className="field">
                  <span>{field.label}</span>
                  <input
                    type={field.type}
                    step={field.type === 'number' ? '0.01' : undefined}
                    {...form.register(field.name, field.type === 'number' ? { valueAsNumber: true } : undefined)}
                  />
                  <small>{form.formState.errors[field.name]?.message ?? '\u00a0'}</small>
                </label>
              ))}

              <label className="field">
                <span>Thumbnail (optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setCreateThumbnail(event.target.files?.[0] ?? null)}
                />
                <small>{createThumbnail ? createThumbnail.name : '\u00a0'}</small>
              </label>

              <button type="submit" disabled={createBookMutation.isPending}>
                {createBookMutation.isPending ? 'Saving...' : 'Create Book'}
              </button>
              {createBookMutation.isError && <div className="error-banner">{createBookMutation.error.message}</div>}
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
