import { z } from 'zod'

export const associationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2).max(2, 'Use 2-letter state'),
  zip: z.string().min(5, 'ZIP is required'),
  fiscal_year_start: z.coerce.number().int().min(1).max(12).default(1),
})

export type AssociationInput = z.infer<typeof associationSchema>
