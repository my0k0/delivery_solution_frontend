import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DeliveryPartner, DeliveryPartnerBody } from '@/features/orders/api'
import { usePermission } from '@/lib/auth/usePermission'

interface DeliveryPartnerFormProps {
  partner: DeliveryPartner | null
  pending: boolean
  onCancel: () => void
  onSave: (body: DeliveryPartnerBody) => Promise<void>
}

export function DeliveryPartnerForm({ partner, pending, onCancel, onSave }: DeliveryPartnerFormProps) {
  const canCreatePartner = usePermission('partners.create')
  const canUpdatePartner = usePermission('partners.update')
  const [name, setName] = useState(partner?.name ?? '')
  const [phone, setPhone] = useState(partner?.phone ?? '')
  const [note, setNote] = useState(partner?.note ?? '')
  const [isActive, setIsActive] = useState(partner?.isActive ?? true)
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave({ name: name.trim(), phone: phone.trim() || null, note: note.trim() || null, isActive })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save delivery partner.')
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2"><Label htmlFor="partner-name">Name</Label><Input id="partner-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="partner-phone">Phone</Label><Input id="partner-phone" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="partner-note">Note</Label><textarea id="partner-note" maxLength={1000} className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={note} onChange={(event) => setNote(event.target.value)} /></div>
      <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />Active partner</label>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>{(partner ? canUpdatePartner : canCreatePartner) && <Button type="submit" disabled={pending}>{pending ? 'Saving…' : partner ? 'Save partner' : 'Create partner'}</Button>}</div>
    </form>
  )
}
