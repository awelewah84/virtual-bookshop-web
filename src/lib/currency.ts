const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return undefined
    }

    const direct = Number(normalized)
    if (Number.isFinite(direct)) {
      return direct
    }

    const stripped = normalized.replace(/[^0-9.-]/g, '')
    const parsed = Number(stripped)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export function formatCurrency(value: unknown, fallback = '-'): string {
  const amount = toNumber(value)
  if (amount === undefined) {
    return fallback
  }

  return gbpFormatter.format(amount)
}
