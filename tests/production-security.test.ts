import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { hashToken } from '../convex/lib/security'
import { validateProductionUrl } from '../shared/deploymentConfig'
import { sanitizeUazapiEndpoint } from '../convex/whatsapp'

const modules = import.meta.glob('../convex/**/*.ts')
// Agendamentos futuros agora criam trabalhos duráveis; não executar timers reais no teste.
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
const settings = { clinicName: 'Clínica teste', clinicSubtitle: 'Teste', primaryColor: 'green', colorPreset: 'emerald', mode: 'light' as const, cancellationNoticeHours: 2, replacementExpiryDays: 30 }
const patient = { name: 'Paciente fictício', documentCpf: '00000000000', phone: '00000000000', birthDate: '1990-01-01', active: true, createdAt: 1 }
async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    for (const role of ['admin', 'professional', 'reception'] as const) {
      const id = await ctx.db.insert('users', { name: role, email: `${role}@example.invalid`, role, passwordHash: 'fixture', salt: 'fixture', active: true, createdAt: 1 })
      await ctx.db.insert('userSessions', { userId: id, token: role, authVersion: 2, expiresAt: Date.now() + 60_000, createdAt: 1 })
    }
    const patientId = await ctx.db.insert('patients', patient)
    const otherPatientId = await ctx.db.insert('patients', { ...patient, name: 'Outro paciente' })
    const roomId = await ctx.db.insert('rooms', { name: 'Sala', type: 'fisioterapia', capacity: 2, color: 'green', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional', email: 'p@example.invalid', phone: '', crefito: 'fixture', specialties: ['fisioterapia'], commissionType: 'fixed', commissionValue: 10, active: true })
    await ctx.db.insert('clinicSettings', { ...settings, uazapiToken: 'fixture-uazapi', resendApiKey: 'fixture-resend', uazapiAdminToken: 'fixture-admin' })
    return { patientId, otherPatientId, roomId, professionalId }
  })
  return { t, ...ids }
}
test('provider failures preserve local instance and hide provider error payload', async () => {
  const {t}=await fixture()
  const instanceId=await t.run(ctx=>ctx.db.insert('whatsappInstances',{name:'Fixture',instanceId:'remote',token:'fixture-secret',status:'connected',isDefault:false,createdAt:1,updatedAt:1}))
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'fixture-secret'}),{status:500})))
  try {
    for (const action of [api.whatsapp.disconnectInstanceAction,api.whatsapp.deleteInstanceAction]) {
      const result=await t.action(action,{sessionToken:'admin',instanceId})
      expect(result.success).toBe(false)
      expect(JSON.stringify(result)).not.toContain('fixture-secret')
      expect((await t.run(ctx=>ctx.db.get(instanceId)))?.status).toBe('connected')
    }
    const instances=await t.query(api.whatsapp.listInstances,{sessionToken:'admin'})
    expect(JSON.stringify(instances)).not.toContain('fixture-secret')
  } finally {vi.unstubAllGlobals()}
})

test('email without provider configuration never reports successful delivery', async () => {
  const {t}=await fixture()
  await t.run(async ctx=>{const config=await ctx.db.query('clinicSettings').first();await ctx.db.patch(config!._id,{resendApiKey:undefined})})
  const result=await t.action(api.notifications.sendEmailNotificationAction,{sessionToken:'admin',recipientName:'Fixture',email:'fixture@example.invalid',subject:'Fixture',html:'Fixture',triggerType:'test'})
  expect(result.success).toBe(false)
  expect(result.status).toBe('failed')
})

describe('Backend authorization', () => {
  test('anonymous, invalid, expired and legacy sessions cannot read patients', async () => {
    const { t } = await fixture()
    await expect(t.query(api.patients.listPatients, {} as any)).rejects.toThrow()
    await expect(t.query(api.patients.listPatients, { sessionToken: 'invalid' })).rejects.toThrow(/Sessão/)
    await t.run(async ctx => {
      const session = await ctx.db.query('userSessions').filter(q => q.eq(q.field('token'), 'admin')).first()
      await ctx.db.patch(session!._id, { expiresAt: Date.now() })
      const legacy = await ctx.db.query('userSessions').filter(q => q.eq(q.field('token'), 'reception')).first()
      await ctx.db.patch(legacy!._id, { authVersion: undefined })
    })
    for (const token of ['admin','reception']) await expect(t.query(api.patients.listPatients, { sessionToken: token })).rejects.toThrow(/Sessão/)
  })
  test('valid staff can read patients; reception cannot read clinical/finance; professional cannot change integrations', async () => {
    const { t, patientId } = await fixture()
    expect(await t.query(api.patients.listPatients, { sessionToken: 'reception' })).toHaveLength(2)
    await expect(t.query(api.clinical.getClinicalRecord, { sessionToken: 'reception', patientId })).rejects.toThrow(/permissão/)
    await expect(t.query(api.finance.listTransactions, { sessionToken: 'reception' })).rejects.toThrow(/permissão/)
    await expect(t.action(api.whatsapp.listServerInstancesAction, { sessionToken: 'professional' })).rejects.toThrow(/permissão/)
    expect(await t.query(api.clinical.getClinicalRecord, { sessionToken: 'professional', patientId })).toBeNull()
  })
  test('inactive user rejected, audit actor cannot be spoofed', async () => {
    const { t } = await fixture()
    await t.mutation(api.audit.logAction, { sessionToken: 'admin', action: 'fixture', userName: 'spoof', userRole: 'system' })
    const logs = await t.query(api.audit.listAuditLogs, { sessionToken: 'admin' })
    expect(logs[0].userName).toBe('admin')
    expect(logs[0].userRole).toBe('admin')
    await t.run(async ctx => {
      const user = await ctx.db.query('users').filter(q=>q.eq(q.field('role'),'admin')).first()
      await ctx.db.patch(user!._id,{active:false})
    })
    await expect(t.query(api.patients.listPatients,{sessionToken:'admin'})).rejects.toThrow(/Sessão/)
  })
  test('public and admin settings never return secrets; blank form preserves them', async () => {
    const { t } = await fixture()
    const publicSettings = await t.query(api.clinic.getSettings, {})
    const adminSettings = await t.query(api.clinic.getAdminSettings, { sessionToken:'admin' })
    for (const response of [publicSettings,adminSettings]) expect(JSON.stringify(response)).not.toMatch(/fixture-(uazapi|resend|admin)/)
    expect(adminSettings?.resendConfigured).toBe(true)
    await t.mutation(api.clinic.updateSettings,{sessionToken:'admin',...settings,resendApiKey:''})
    expect(await t.run(async ctx=>(await ctx.db.query('clinicSettings').first())?.resendApiKey)).toBe('fixture-resend')
  })
  test('login attempts survive rejected passwords and throttle subsequent calls', async () => {
    const { t } = await fixture()
    for(let i=0;i<5;i++) await expect(t.action(api.authActions.login,{email:'admin@example.invalid',password:'incorrect'})).rejects.toThrow(/Credenciais/)
    await expect(t.action(api.authActions.login,{email:'admin@example.invalid',password:'incorrect'})).rejects.toThrow(/Muitas tentativas/)
  })
})
describe('Integrity and patient boundary',()=>{
  test('toggle patient active preserves all personal fields',async()=>{
    const {t,patientId}=await fixture()
    await t.mutation(api.patients.updatePatient,{sessionToken:'admin',id:patientId,active:false})
    const result=await t.query(api.patients.getPatient,{sessionToken:'admin',id:patientId})
    expect(result).toMatchObject({...patient,active:false})
  })
  test('positive financial write works, negative/NaN/fractional-cent values rejected',async()=>{
    const {t}=await fixture()
    const args={sessionToken:'admin',type:'income' as const,category:'Teste',description:'Teste',dueDate:'2026-09-08',paymentMethod:'pix' as const,status:'pending' as const}
    const id=await t.mutation(api.finance.createTransaction,{...args,amount:10.25})
    expect(id).toBeTruthy()
    for(const amount of [-1,0,Number.NaN,10.001]) await expect(t.mutation(api.finance.createTransaction,{...args,amount})).rejects.toThrow()
    await expect(t.mutation(api.finance.updateTransaction,{sessionToken:'admin',id,amount:-1})).rejects.toThrow()
  })
  test('schedule edits reject inverted times, conflicts and capacity reduction; valid edit works',async()=>{
    const {t,roomId,professionalId}=await fixture()
    const args={sessionToken:'admin',title:'Sessão',type:'individual' as const,specialty:'fisioterapia' as const,roomId,professionalId,date:'2026-09-09',startTime:'09:00',endTime:'10:00',maxCapacity:1}
    const id=await t.mutation(api.schedules.createSchedule,args)
    await t.mutation(api.schedules.createSchedule,{...args,startTime:'11:00',endTime:'12:00'})
    await expect(t.mutation(api.schedules.updateSchedule,{sessionToken:'admin',id,startTime:'11:00'})).rejects.toThrow(/Intervalo/)
    await expect(t.mutation(api.schedules.updateSchedule,{sessionToken:'admin',id,startTime:'11:00',endTime:'12:00'})).rejects.toThrow(/Conflito/)
    await expect(t.mutation(api.schedules.updateSchedule,{sessionToken:'admin',id,maxCapacity:0})).rejects.toThrow(/Capacidade/)
    await t.mutation(api.schedules.updateSchedule,{sessionToken:'admin',id,startTime:'08:30'})
    expect(await t.run(ctx=>ctx.db.get(id))).toMatchObject({startTime:'08:30'})
  })
  test('service stores editable group capacity and avulsa/package prices', async () => {
    const { t } = await fixture()
    const id = await t.mutation(api.services.createService, {
      sessionToken: 'admin',
      name: 'Pilates em grupo - teste',
      modality: 'turma',
      specialty: 'pilates',
      maxCapacity: 8,
      durationMinutes: 55,
      defaultPrice: 90,
      packagePricePerSession: 75,
      active: true,
    })

    expect(await t.query(api.services.getService, { sessionToken: 'admin', id })).toMatchObject({
      maxCapacity: 8,
      defaultPrice: 90,
      packagePricePerSession: 75,
    })

    await t.mutation(api.services.updateService, {
      sessionToken: 'admin',
      id,
      maxCapacity: 6,
      packagePricePerSession: null,
    })
    expect(await t.query(api.services.getService, { sessionToken: 'admin', id })).toMatchObject({
      maxCapacity: 6,
      defaultPrice: 90,
    })
    expect((await t.query(api.services.getService, { sessionToken: 'admin', id }))?.packagePricePerSession).toBeUndefined()

    await expect(t.mutation(api.services.updateService, { sessionToken: 'admin', id, maxCapacity: 1 })).rejects.toThrow(/entre 2 e 100/)
    await t.mutation(api.services.updateService, { sessionToken: 'admin', id, modality: 'individual' })
    expect((await t.query(api.services.getService, { sessionToken: 'admin', id }))?.maxCapacity).toBe(1)
  })
  test('portal token is scoped, expires and cannot be replaced with staff token',async()=>{
    const {t,patientId,otherPatientId}=await fixture()
    const portalToken='a'.repeat(64)
    const tokenHash=await hashToken(portalToken)
    const sessionId=await t.run(ctx=>ctx.db.insert('patientSessions',{patientId,tokenHash,authVersion:2,createdAt:Date.now(),expiresAt:Date.now()+60_000}))
    expect(await t.query(api.portalAccess.current,{portalToken})).toEqual({_id:patientId})
    await expect(t.query(api.patientPortal.getPatientPortalData,{portalToken,patientId:otherPatientId})).rejects.toThrow(/Acesso/)
    await expect(t.query(api.patientPortal.getPatientPortalData,{portalToken:'admin',patientId})).rejects.toThrow(/Acesso/)
    await t.run(ctx=>ctx.db.patch(sessionId,{expiresAt:Date.now()}))
    expect(await t.query(api.portalAccess.current,{portalToken})).toBeNull()
  })
})
test('provisioning requires 12 characters; login works and reset revokes old sessions',async()=>{
  const {t}=await fixture()
  const account={email:'real@example.invalid',name:'Conta de teste',role:'admin' as const,password:'Test-1234567'}
  await expect(t.action(internal.authActions.provisionUser,{...account,password:'Test-123456'})).rejects.toThrow(/12 a 256/)
  await t.action(internal.authActions.provisionUser,account)
  const login=await t.action(api.authActions.login,{email:account.email,password:account.password})
  expect(login.token).toMatch(/^[a-f0-9]{64}$/)
  expect(await t.query(api.auth.getCurrentUser,{token:login.token})).toMatchObject({name:account.name,role:'admin'})
  await t.action(internal.authActions.provisionUser,{...account,password:'new-isolated-test-password-54321'})
  expect(await t.query(api.auth.getCurrentUser,{token:login.token})).toBeNull()
})
test('password reset revokes previous patient session; logout invalidates new session',async()=>{
  const {t,patientId}=await fixture()
  await t.mutation(api.patients.updatePatient,{sessionToken:'admin',id:patientId,documentCpf:'52998224725'})
  await t.action(api.portalAuth.changePassword,{sessionToken:'admin',patientId,password:'@mudar123'})
  const first=await t.action(api.portalAuth.login,{type:'cpf',identifier:'52998224725',password:'@mudar123'})
  expect(await t.query(api.portalAccess.current,{portalToken:first.token})).toEqual({_id:patientId})
  await t.action(api.portalAuth.changePassword,{sessionToken:'admin',patientId,password:'NovaSenha123'})
  const second=await t.action(api.portalAuth.login,{type:'cpf',identifier:'52998224725',password:'NovaSenha123'})
  expect(await t.query(api.portalAccess.current,{portalToken:first.token})).toBeNull()
  const portal=await t.query(api.patientPortal.getPatientPortalData,{portalToken:second.token,patientId})
  expect(portal?.patient.name).toBe(patient.name)
  await t.mutation(api.portalAccess.logout,{portalToken:second.token})
  expect(await t.query(api.portalAccess.current,{portalToken:second.token})).toBeNull()
})
test('public booking rejects unoffered intervals before altering patients',async()=>{
  const {t}=await fixture()
  await expect(t.action(api.bookingBuilder.submitPublicBooking,{name:'Pessoa',documentCpf:'52998224725',phone:'11987654321',birthDate:'1990-01-01',date:'2099-09-09',startTime:'25:00',endTime:'26:00',answers:[]})).rejects.toThrow()
  expect(await t.query(api.patients.listPatients,{sessionToken:'admin'})).toHaveLength(2)
})
test('deployment and integration URL validation reject unsafe destinations',()=>{
  for(const value of [undefined,'http://127.0.0.1:3210','https://localhost','https://user:pass@host.invalid']) expect(()=>validateProductionUrl(value)).toThrow()
  expect(validateProductionUrl('https://fixture.convex.cloud')).toBe('https://fixture.convex.cloud')
  for(const value of ['http://whatpress.uazapi.com','https://whatpress.uazapi.com.evil.invalid','https://user:pass@whatpress.uazapi.com','https://127.0.0.1']) expect(()=>sanitizeUazapiEndpoint(value)).toThrow()
})

test('commission expense rejects negative amount through indirect financial writer',async()=>{
  const {t,professionalId}=await fixture()
  await expect(t.mutation(api.finance.closeProfessionalCommission,{sessionToken:'admin',professionalId,periodMonthYear:'2026-09',totalAttendances:1,totalGrossAmount:100,totalCommissionAmount:-10,status:'pending'})).rejects.toThrow(/valor positivo/)
  expect(await t.query(api.finance.listTransactions,{sessionToken:'admin'})).toHaveLength(0)
})
test('patient cannot replay a completed reschedule to create another reservation',async()=>{
  const {t,patientId,roomId,professionalId}=await fixture()
  const base={title:'Teste',type:'individual' as const,specialty:'fisioterapia' as const,roomId,professionalId,date:'2099-09-09',maxCapacity:1,status:'scheduled' as const}
  const {source,first,second}=await t.run(async ctx=>{
    const sourceSchedule=await ctx.db.insert('schedules',{...base,startTime:'09:00',endTime:'10:00'})
    const first=await ctx.db.insert('schedules',{...base,startTime:'11:00',endTime:'12:00'})
    const second=await ctx.db.insert('schedules',{...base,startTime:'13:00',endTime:'14:00'})
    const source=await ctx.db.insert('scheduleParticipants',{scheduleId:sourceSchedule,patientId,status:'scheduled'})
    return {source,first,second}
  })
  await t.mutation(api.patients.updatePatient,{sessionToken:'admin',id:patientId,documentCpf:'52998224725'})
  await t.action(api.portalAuth.changePassword,{sessionToken:'admin',patientId,password:'@mudar123'})
  const link=await t.action(api.portalAuth.login,{type:'cpf',identifier:'52998224725',password:'@mudar123'})
  await t.mutation(api.patientPortal.rescheduleAppointmentByPatient,{portalToken:link.token,patientId,participantId:source,targetScheduleId:first})
  await expect(t.mutation(api.patientPortal.rescheduleAppointmentByPatient,{portalToken:link.token,patientId,participantId:source,targetScheduleId:second})).rejects.toThrow(/processado/)
  const participants=await t.run(ctx=>ctx.db.query('scheduleParticipants').collect())
  expect(participants.filter(p=>p.status==='scheduled')).toHaveLength(1)
})
test('pain history remains available from persisted SOAP records',async()=>{
  const {t,patientId,professionalId}=await fixture()
  await t.mutation(api.clinical.addSoapEvolution,{sessionToken:'admin',patientId,professionalId,date:'2026-09-09',subjective:'Teste',objective:'Teste',assessment:'Teste',plan:'Teste',painScaleAfter:3})
  const history=await t.query(api.clinical.getPainEvolutionHistory,{sessionToken:'professional',patientId})
  expect(history).toMatchObject([{date:'2026-09-09',painLevel:3}])
})
test('clinical record deletion requires clinical access, audits the actor and preserves SOAP history',async()=>{
  const {t,patientId,otherPatientId,professionalId}=await fixture()
  const recordId=await t.run(ctx=>ctx.db.insert('clinicalRecords',{patientId,chiefComplaint:'Queixa',hpi:'Histórico',medicalHistory:'Histórico médico',medications:'Nenhuma',painScaleEva:4,painLocation:'Lombar',clinicalGoals:'Melhorar mobilidade',updatedAt:1}))
  const evolutionId=await t.mutation(api.clinical.addSoapEvolution,{sessionToken:'admin',patientId,professionalId,date:'2026-09-09',subjective:'Relato',objective:'Objetivo',assessment:'Avaliação',plan:'Plano',painScaleAfter:3})

  await expect(t.mutation(api.clinical.deleteClinicalRecord,{sessionToken:'reception',patientId})).rejects.toThrow(/permissão/)
  expect((await t.run(ctx=>ctx.db.get(recordId)))?._id).toBe(recordId)

  const missing=await t.mutation(api.clinical.deleteClinicalRecord,{sessionToken:'admin',patientId:otherPatientId})
  expect(missing).toEqual({success:false,message:'Prontuário não encontrado'})

  const deleted=await t.mutation(api.clinical.deleteClinicalRecord,{sessionToken:'admin',patientId})
  expect(deleted.success).toBe(true)
  expect(await t.run(ctx=>ctx.db.get(recordId))).toBeNull()
  expect(await t.run(ctx=>ctx.db.get(evolutionId))).not.toBeNull()

  const logs=await t.query(api.audit.listAuditLogs,{sessionToken:'admin',patientId})
  expect(logs.some(log=>log.action==='delete_clinical_record'&&log.userName==='admin')).toBe(true)
})
