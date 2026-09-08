// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks=vi.hoisted(()=>({write:vi.fn()}))
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'fixture',name:'Teste',role:'admin'},role:'admin',isAdmin:true})}))
vi.mock('@/lib/staffConvex',()=>({
  useQuery:()=>undefined,
  useMutation:(reference:any)=>(args:any)=>mocks.write(getFunctionName(reference),args),
  useAction:() => vi.fn(),
}))
vi.mock('@/components/ui/dialog',()=>{
  const Box=({children}:any)=><div>{children}</div>
  return {Dialog:Box,DialogContent:Box,DialogHeader:Box,DialogTitle:Box,DialogDescription:Box,DialogFooter:Box}
})
import { ClinicDataProvider, useClinicData } from '../src/contexts/ClinicDataContext'
import { LgpdConsentModal } from '../src/components/clinical/LgpdConsentModal'
const patient={id:'fixture',name:'Paciente',documentCpf:'00000000000',phone:'00000000000',birthDate:'1990-01-01',active:true,createdAt:1}
function ConsentFlow(){const {savePatientConsent}=useClinicData();return <LgpdConsentModal open onOpenChange={()=>{}} patient={patient} onSaveConsent={savePatientConsent}/>}
function SavePatient(){const {addPatient}=useClinicData();const [message,setMessage]=React.useState('');return <><button onClick={async()=>{try{const id=await addPatient(patient);setMessage('Salvo: '+id)}catch{setMessage('Falha ao salvar')}}}>Salvar paciente</button><p>{message}</p></>}
function DeleteRecord(){const {deleteClinicalRecord}=useClinicData();const [message,setMessage]=React.useState('');return <><button onClick={async()=>{try{await deleteClinicalRecord('fixture');setMessage('Excluído')}catch(error){setMessage('Falha: '+(error instanceof Error?error.message:'erro'))}}}>Excluir prontuário</button><p>{message}</p></>}
beforeEach(()=>{
  const entries=new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key),clear:()=>entries.clear()})
})
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals()})
test('consent failure propagates through provider and never announces success',async()=>{
  mocks.write.mockRejectedValue(new Error('Falha de rede'))
  const alert=vi.spyOn(window,'alert').mockImplementation(()=>{})
  render(<ClinicDataProvider><ConsentFlow/></ClinicDataProvider>)
  const buttons=screen.getAllByRole('button')
  const sign=buttons.find(button=>/Assinar Todos|Aceitar|Assinar/i.test(button.textContent||''))!
  expect(sign).toBeTruthy()
  fireEvent.click(sign)
  await waitFor(()=>expect(alert).toHaveBeenCalledWith('Falha de rede'))
  expect(screen.queryByText(/atualizado com sucesso|foram assinados com sucesso/i)).toBeNull()
  alert.mockRestore()
})
test('patient creation awaits server response and shows failure on rejection',async()=>{
  mocks.write.mockRejectedValue(new Error('Falha'))
  render(<ClinicDataProvider><SavePatient/></ClinicDataProvider>)
  fireEvent.click(screen.getByRole('button',{name:'Salvar paciente'}))
  await screen.findByText('Falha ao salvar')
  expect(screen.queryByText(/^Salvo:/)).toBeNull()
})
test('patient creation returns the confirmed server ID',async()=>{
  mocks.write.mockResolvedValue('server-id')
  render(<ClinicDataProvider><SavePatient/></ClinicDataProvider>)
  fireEvent.click(screen.getByRole('button',{name:'Salvar paciente'}))
  await screen.findByText('Salvo: server-id')
})
test('clinical record deletion does not announce success when the server finds no record',async()=>{
  mocks.write.mockResolvedValue({success:false,message:'Prontuário não encontrado'})
  render(<ClinicDataProvider><DeleteRecord/></ClinicDataProvider>)
  fireEvent.click(screen.getByRole('button',{name:'Excluir prontuário'}))
  await screen.findByText('Falha: Prontuário não encontrado')
  expect(screen.queryByText('Excluído')).toBeNull()
})
