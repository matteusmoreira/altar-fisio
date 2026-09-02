import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getPatientConsents = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patientConsents")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect()
  },
})

export const saveConsent = mutation({
  args: {
    patientId: v.id("patients"),
    termType: v.union(
      v.literal("tcle_treatment"),
      v.literal("lgpd_data_processing"),
      v.literal("postural_photo_consent")
    ),
    accepted: v.boolean(),
    signedByName: v.string(),
    documentVersion: v.string(),
    ipAddress: v.optional(v.string()),
    notes: v.optional(v.string()),
    userName: v.string(),
    userRole: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("patientConsents")
      .withIndex("by_patient_term", (q) =>
        q.eq("patientId", args.patientId).eq("termType", args.termType)
      )
      .first()

    const now = Date.now()
    let consentId

    if (existing) {
      await ctx.db.patch(existing._id, {
        accepted: args.accepted,
        acceptedAt: now,
        signedByName: args.signedByName,
        documentVersion: args.documentVersion,
        ipAddress: args.ipAddress,
        notes: args.notes,
      })
      consentId = existing._id
    } else {
      consentId = await ctx.db.insert("patientConsents", {
        patientId: args.patientId,
        termType: args.termType,
        accepted: args.accepted,
        acceptedAt: now,
        signedByName: args.signedByName,
        documentVersion: args.documentVersion,
        ipAddress: args.ipAddress,
        notes: args.notes,
      })
    }

    // Busca nome do paciente para registro no log de auditoria
    const patient = await ctx.db.get(args.patientId)

    // Registra na trilha de auditoria LGPD
    await ctx.db.insert("auditLogs", {
      userName: args.userName,
      userRole: args.userRole,
      action: "consent_registered",
      patientId: args.patientId,
      patientName: patient?.name,
      details: `Consentimento ${args.termType} (${args.documentVersion}) marcado como ${args.accepted ? "ACEITO" : "RECUSADO"} por ${args.signedByName}`,
      ipAddress: args.ipAddress,
      timestamp: now,
    })

    return consentId
  },
})
