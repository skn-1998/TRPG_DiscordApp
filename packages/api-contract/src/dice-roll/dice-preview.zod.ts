import { z } from 'zod'

export const dicePreviewRequestSchema = z
  .object({
    notation: z.string().min(1),
    gameSystemId: z.string().min(1).optional()
  })
  .strict()

export const dicePreviewResponseSchema = z
  .object({
    total: z.number().finite(),
    details: z.string()
  })
  .strict()

export type DicePreviewRequest = z.infer<typeof dicePreviewRequestSchema>
export type DicePreviewResponse = z.infer<typeof dicePreviewResponseSchema>
