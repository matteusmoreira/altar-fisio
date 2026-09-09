import { expect, test } from "vitest"
import { convexTest } from "convex-test"
import schema from "../convex/schema"
import { api } from "../convex/_generated/api"
const modules = import.meta.glob("../convex/**/*.ts")

async function fixture() {
  const t = convexTest(schema, modules)
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { name: "Admin", email: "test@example.invalid", role: "admin", active: true, salt: "test", passwordHash: "test", createdAt: Date.now() })
    await ctx.db.insert("userSessions", { userId, token: "staff", authVersion: 2, expiresAt: Date.now() + 86400000, createdAt: Date.now() })
  })
  const config = await t.query(api.bookingBuilder.getBookingConfig)
  return { t, args: { sessionToken: "staff", requireApproval: false, steps: config.steps, fields: config.fields } }
}

test("saves custom logos, preserves them on text edits, and persists an empty list", async () => {
  const { t, args } = await fixture()
  const insurancePartners = [{ id: "custom", name: "Meu Plano", logo: "https://example.com/logo.png" }]
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, insurancePartners })
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, welcomeTitle: "Novo título" })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).insurancePartners).toEqual(insurancePartners)
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, insurancePartners: [] })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).insurancePartners).toEqual([])
})

test("persists added and removed intake steps while protecting booking requirements", async () => {
  const { t, args } = await fixture()
  const steps = [...args.steps, { id: "extra", title: "Objetivos", type: "intake_form" as const, order: 4 }]
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, steps })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).steps).toHaveLength(4)
  await t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, steps: steps.filter(s => s.type !== "intake_form"), fields: [] })
  expect((await t.query(api.bookingBuilder.getBookingConfig)).steps).toHaveLength(2)
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, steps: [] })).rejects.toThrow(/horário/)
})

test("rejects orphan fields, invalid image URLs and unauthenticated writes", async () => {
  const { t, args } = await fixture()
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, steps: args.steps.filter(s => s.type !== "intake_form") })).rejects.toThrow(/etapa de perguntas/)
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, insurancePartners: [{ id: "bad", name: "Bad", logo: "javascript:alert(1)" }] })).rejects.toThrow(/imagem/)
  await expect(t.mutation(api.bookingBuilder.updateBookingConfig, { ...args, sessionToken: "invalid", insurancePartners: [] })).rejects.toThrow()
})
