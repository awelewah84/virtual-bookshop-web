import { z } from 'zod'

export const createBookSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  author: z.string().min(2, 'Author is required'),
  price: z.number().positive('Price must be greater than 0'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
})

export const createReservationSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required'),
  customerEmail: z.string().email('Enter a valid email address'),
  bookIds: z.array(z.string().min(1, 'Select a book')).min(1, 'At least one book is required').max(5, 'Maximum 5 books'),
  reservationHours: z.number().positive('Hours must be greater than 0').optional(),
})

export const createPublicReservationSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required'),
  email: z.string().email('Enter a valid email address'),
  bookIds: z.array(z.string().min(1, 'Select a book')).min(1, 'At least one book is required').max(5, 'Maximum 5 books'),
  reservationHours: z.number().positive('Hours must be greater than 0').optional(),
})

export const updateReservationAdminSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required'),
  customerEmail: z.string().email('Enter a valid email address'),
  bookIds: z.array(z.string().min(1, 'Select a book')).min(1, 'At least one book is required').max(5, 'Maximum 5 books'),
  reservationHours: z.number().positive('Hours must be greater than 0').optional(),
})

export const updateStockSchema = z.object({
  bookId: z.string().min(1, 'Select a book'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
})

export const createRestockSchema = z.object({
  bookId: z.string().min(1, 'Select a book'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().max(120).optional(),
})

export type CreateBookSchema = z.infer<typeof createBookSchema>
export type CreateReservationSchema = z.infer<typeof createReservationSchema>
export type CreatePublicReservationSchema = z.infer<typeof createPublicReservationSchema>
export type UpdateReservationAdminSchema = z.infer<typeof updateReservationAdminSchema>
export type UpdateStockSchema = z.infer<typeof updateStockSchema>
export type CreateRestockSchema = z.infer<typeof createRestockSchema>
