import { API_BASE_URL } from './env'
import { getAccessToken } from '../auth/authStorage'

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return (await response.text()) as T
}

export function resolveList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[]
  }

  if (data && typeof data === 'object') {
    const bag = data as { items?: unknown; data?: unknown }
    if (Array.isArray(bag.items)) {
      return bag.items as T[]
    }
    if (Array.isArray(bag.data)) {
      return bag.data as T[]
    }
  }

  return []
}
