import { internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { sessionUser } from './lib/security'

export const getSessionUser = internalQuery({
  args: { token: v.string() },
  handler: (ctx, args) => sessionUser(ctx, args.token),
})
