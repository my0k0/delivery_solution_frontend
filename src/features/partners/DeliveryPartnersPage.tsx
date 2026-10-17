import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/lib/auth/gate'
import { getApiErrorMessage } from '@/lib/api/client'
import { createDeliveryPartner, deleteDeliveryPartner, fetchDeliveryPartners, orderKeys, updateDeliveryPartner, type DeliveryPartner, type DeliveryPartnerBody } from '@/features/orders/api'
import { DeliveryPartnerDialog } from '@/features/partners/DeliveryPartnerDialog'

export function DeliveryPartnersPage() {
  const canCreate = usePermission('partners.create')
  const canUpdate = usePermission('partners.update')
  const canDelete = usePermission('partners.delete')
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null)
  const [deletingPartner, setDeletingPartner] = useState<DeliveryPartner | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()
  const partners = useQuery({ queryKey: orderKeys.partners, queryFn: fetchDeliveryPartners })
  const saveMutation = useMutation({
    mutationFn: (input: { partner: DeliveryPartner | null; body: DeliveryPartnerBody }) => input.partner ? updateDeliveryPartner(input.partner.id, input.body) : createDeliveryPartner(input.body),
    onSuccess: async () => { toast.success(editingPartner ? 'Delivery partner updated' : 'Delivery partner created'); setIsDialogOpen(false); setEditingPartner(null); await queryClient.invalidateQueries({ queryKey: orderKeys.partners }) },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryPartner,
    onSuccess: async () => { toast.success('Delivery partner deleted'); setDeletingPartner(null); await queryClient.invalidateQueries({ queryKey: orderKeys.partners }) },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Delivery partners</h1><p className="text-sm text-muted-foreground">Manage external carriers used for partner-assigned orders.</p></div>{canCreate && <Button onClick={() => { setEditingPartner(null); setIsDialogOpen(true) }}><Plus className="size-4" />Create partner</Button>}</div>
      {partners.isLoading ? <div className="space-y-2">{[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-md bg-muted" />)}</div> : partners.isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(partners.error)}</p> : partners.data?.length ? <div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Note</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {partners.data.map((partner) => <TableRow key={partner.id}><TableCell className="font-medium">{partner.name}</TableCell><TableCell>{partner.phone ?? '—'}</TableCell><TableCell className="max-w-80 truncate">{partner.note ?? '—'}</TableCell><TableCell><Badge className={partner.isActive ? 'bg-success text-success-foreground' : ''} variant={partner.isActive ? 'secondary' : 'outline'}>{partner.isActive ? 'Active' : 'Inactive'}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">{canUpdate && <Button size="sm" variant="outline" onClick={() => { setEditingPartner(partner); setIsDialogOpen(true) }}>Edit</Button>}{canDelete && <Button size="sm" variant="destructive" onClick={() => setDeletingPartner(partner)}>Delete</Button>}</div></TableCell></TableRow>)}
      </TableBody></Table></div> : <EmptyState title="No delivery partners yet" description="Create a delivery partner to make it available for township defaults and orders." />}
      <DeliveryPartnerDialog partner={editingPartner} open={isDialogOpen} pending={saveMutation.isPending} onClose={() => { setIsDialogOpen(false); setEditingPartner(null) }} onSave={async (body) => { await saveMutation.mutateAsync({ partner: editingPartner, body }) }} />
      <DeleteConfirmDialog open={deletingPartner !== null} onClose={() => setDeletingPartner(null)} title="Delete delivery partner?" description={`Delete ${deletingPartner?.name ?? 'this partner'}? Orders or township defaults using it can prevent deletion.`} onConfirm={async () => { if (deletingPartner) await deleteMutation.mutateAsync(deletingPartner.id) }} />
    </div>
  )
}
