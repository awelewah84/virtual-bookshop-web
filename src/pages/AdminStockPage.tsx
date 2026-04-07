import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useToast } from '../hooks/useToast'
import { createRestockRequest, listCatalog, listRestockRequests, updateBookStock } from '../lib/api'
import { createRestockSchema, updateStockSchema, type CreateRestockSchema, type UpdateStockSchema } from '../lib/schemas'

export function AdminStockPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const catalogQuery = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })
  const restockQuery = useQuery({ queryKey: ['restock'], queryFn: listRestockRequests })

  const stockForm = useForm<UpdateStockSchema>({
    resolver: zodResolver(updateStockSchema),
    defaultValues: { bookId: '', stock: 0 },
  })

  const restockForm = useForm<CreateRestockSchema>({
    resolver: zodResolver(createRestockSchema),
    defaultValues: { bookId: '', quantity: 20, reason: '' },
  })

  const stockMutation = useMutation({
    mutationFn: async (values: UpdateStockSchema) => updateBookStock(values.bookId, { stock: values.stock }),
    onSuccess: async () => {
      stockForm.reset({ bookId: '', stock: 0 })
      toast.success('Stock updated successfully.')
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const restockMutation = useMutation({
    mutationFn: createRestockRequest,
    onSuccess: async () => {
      restockForm.reset({ bookId: '', quantity: 20, reason: '' })
      toast.success('Restock request created successfully.')
      await queryClient.invalidateQueries({ queryKey: ['restock'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="panel-grid">
      <section className="panel">
        <h2>Update Stock</h2>
        <p className="panel-note">Admin-only stock update endpoint: PATCH /api/catalog/{'{bookId}'}/stock</p>

        <form onSubmit={stockForm.handleSubmit((values) => stockMutation.mutate(values))}>
          <label className="field">
            <span>Book</span>
            <select {...stockForm.register('bookId')}>
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
            <small>{stockForm.formState.errors.bookId?.message ?? '\u00a0'}</small>
          </label>

          <label className="field">
            <span>New Stock Count</span>
            <input type="number" min={0} {...stockForm.register('stock', { valueAsNumber: true })} />
            <small>{stockForm.formState.errors.stock?.message ?? '\u00a0'}</small>
          </label>

          <button type="submit" disabled={stockMutation.isPending}>
            {stockMutation.isPending ? 'Updating...' : 'Update Stock'}
          </button>
          {stockMutation.isSuccess && <div className="success-banner">Catalog stock was updated.</div>}
          {stockMutation.isError && <div className="error-banner">{stockMutation.error.message}</div>}
        </form>
      </section>

      <section className="panel">
        <h2>Create Restock Request</h2>
        <p className="panel-note">Operations flow for warehouse replenishment.</p>

        <form onSubmit={restockForm.handleSubmit((values) => restockMutation.mutate(values))}>
          <label className="field">
            <span>Book</span>
            <select {...restockForm.register('bookId')}>
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
            <small>{restockForm.formState.errors.bookId?.message ?? '\u00a0'}</small>
          </label>

          <label className="field">
            <span>Quantity</span>
            <input type="number" min={1} {...restockForm.register('quantity', { valueAsNumber: true })} />
            <small>{restockForm.formState.errors.quantity?.message ?? '\u00a0'}</small>
          </label>

          <label className="field">
            <span>Reason (optional)</span>
            <input type="text" {...restockForm.register('reason')} placeholder="Promotion demand increase" />
            <small>{restockForm.formState.errors.reason?.message ?? '\u00a0'}</small>
          </label>

          <button type="submit" disabled={restockMutation.isPending}>
            {restockMutation.isPending ? 'Submitting...' : 'Create Restock Request'}
          </button>
          {restockMutation.isSuccess && <div className="success-banner">Restock request was added to queue.</div>}
          {restockMutation.isError && <div className="error-banner">{restockMutation.error.message}</div>}
        </form>
      </section>

      <section className="panel">
        <h2>Restock Queue</h2>
        <p className="panel-note">Latest restock requests for operations follow-up.</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Book ID</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(restockQuery.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5}>No restock requests in queue.</td>
                </tr>
              )}

              {(restockQuery.data ?? []).slice(0, 12).map((request, index) => {
                const id = String(request.requestNo ?? request.id ?? `restock-${index}`)
                const bookId = String(request.bookId ?? '-')
                const quantity = typeof request.quantity === 'number' ? request.quantity : '-'
                const status = String(request.status ?? 'Pending')
                const reason = String(request.reason ?? '-')

                return (
                  <tr key={id}>
                    <td>{id}</td>
                    <td>{bookId}</td>
                    <td>{quantity}</td>
                    <td>{status}</td>
                    <td>{reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
