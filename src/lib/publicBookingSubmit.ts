import { ConvexHttpClient } from 'convex/browser'
import { ConvexError } from 'convex/values'
import type { FunctionArgs } from 'convex/server'
import { api } from '@convex/_generated/api'

type BookingArgs = Omit<FunctionArgs<typeof api.bookingBuilder.submitPublicBooking>, 'requestId'>

export function createPublicBookingSubmit(url: string) {
  const client = new ConvexHttpClient(url)
  let previousPayload: string | undefined
  let requestId: string
  return async (args: BookingArgs) => {
    const payload = JSON.stringify(args)
    if (payload !== previousPayload) {
      requestId = crypto.randomUUID()
      previousPayload = payload
    }
    // Reuse the receipt key if the response is lost, including a manual retry.
    for (let attempt = 0; ; attempt++) {
      try {
        return await client.action(api.bookingBuilder.submitPublicBooking, { ...args, requestId })
      } catch (error) {
        if (error instanceof ConvexError && typeof error.data === 'string') throw error
        if (attempt === 0 && error instanceof TypeError) continue
        throw new ConvexError('Não foi possível receber a confirmação. Confira sua conexão e tente confirmar novamente com os mesmos dados. Se o problema continuar, consulte a recepção antes de escolher outro horário.')
      }
    }
  }
}
