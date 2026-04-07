import { useMemo, useState } from 'react'

type Props = {
  title: string
  thumbnailUrl?: string
  imageClassName: string
  fallbackClassName: string
  maxTitleLength?: number
}

function truncateTitle(value: string, maxLength: number): string {
  const clean = value.trim()
  if (!clean) {
    return 'UNTITLED BOOK'
  }

  if (clean.length <= maxLength) {
    return clean
  }

  return `${clean.slice(0, maxLength)}...`
}

export function BookThumbnail({ title, thumbnailUrl, imageClassName, fallbackClassName, maxTitleLength = 42 }: Props) {
  const [failedUrl, setFailedUrl] = useState('')

  const normalizedUrl = useMemo(() => {
    if (typeof thumbnailUrl !== 'string') {
      return ''
    }

    return thumbnailUrl.trim()
  }, [thumbnailUrl])

  const canRenderImage = normalizedUrl.length > 0 && failedUrl !== normalizedUrl

  if (canRenderImage) {
    return (
      <img
        className={imageClassName}
        src={normalizedUrl}
        alt={`${title} thumbnail`}
        onError={() => setFailedUrl(normalizedUrl)}
      />
    )
  }

  return (
    <div className={`fallback-thumb ${fallbackClassName}`} aria-label={`${title} default thumbnail`}>
      <span className="fallback-thumb-icon" aria-hidden="true">
        📘
      </span>
      <span className="fallback-thumb-title">{truncateTitle(title, maxTitleLength)}</span>
    </div>
  )
}
