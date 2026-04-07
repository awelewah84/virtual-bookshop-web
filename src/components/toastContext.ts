import { createContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
