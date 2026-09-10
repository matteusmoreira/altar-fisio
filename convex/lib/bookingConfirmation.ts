import { v } from 'convex/values'

export const bookingConfirmationValidator = v.object({
  confirmedTitle: v.string(), pendingTitle: v.string(), pendingMessage: v.string(),
  portalTitle: v.string(), portalButton: v.string(), receiptTitle: v.string(),
  paymentTitle: v.string(), paymentMessage: v.string(),
  locationTitle: v.string(), address: v.string(),
  instructionsTitle: v.string(), instructionsMessage: v.string(),
  calendarButton: v.string(), whatsappButton: v.string(), restartButton: v.string(),
  showPortal: v.boolean(), showReceipt: v.boolean(), showPayment: v.boolean(),
  showLocation: v.boolean(), showInstructions: v.boolean(), showCalendar: v.boolean(),
  showWhatsapp: v.boolean(), showRestart: v.boolean(),
})
