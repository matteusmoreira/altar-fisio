import { ConvexError } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
export async function assertPortalBookingOpen(ctx: QueryCtx) {
  if ((await ctx.db.query('clinicSettings').first())?.portalBookingEnabled === false) throw new ConvexError('Agendamentos pelo portal estão fechados. Consulte a mensagem da clínica.')
}
