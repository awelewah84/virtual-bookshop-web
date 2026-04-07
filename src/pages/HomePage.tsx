import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { getHealth, listCatalog, listReservations, listRestockRequests } from '../lib/api'

function asText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: listCatalog })
  const reservations = useQuery({
    queryKey: ['reservations'],
    queryFn: listReservations,
    enabled: isAuthenticated,
  })
  const restock = useQuery({
    queryKey: ['restock'],
    queryFn: listRestockRequests,
    enabled: isAuthenticated,
  })

  return (
    <section className="stats-grid">
      <article>
        <h2>API Health</h2>
        <p>
          {health.isLoading && 'Checking...'}
          {health.isError && `Error: ${health.error.message}`}
          {health.isSuccess && asText(health.data)}
        </p>
      </article>
      <article>
        <h2>Catalog Size</h2>
        <p>{catalog.data?.length ?? 0} books</p>
      </article>
      <article>
        <h2>Reservations</h2>
        <p>{isAuthenticated ? `${reservations.data?.length ?? 0} active` : 'Login required'}</p>
      </article>
      <article>
        <h2>Restock Requests</h2>
        <p>{isAuthenticated ? `${restock.data?.length ?? 0} queued` : 'Login required'}</p>
      </article>
    </section>
  )
}
