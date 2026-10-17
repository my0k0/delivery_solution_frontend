import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePermission } from '@/lib/auth/usePermission'
import { readApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { formatDecimalAmount } from '@/lib/utils'
import { TownshipDialog } from './components/TownshipDialog'
import { useDeleteTownship, useTownships, type Township } from './api'

export function TownshipsPage() {
  const { data: townships = [], isLoading, isError, error } = useTownships()
  const canCreate = usePermission('townships.create')
  const canUpdate = usePermission('townships.update')
  const canDelete = usePermission('townships.delete')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [townshipToEdit, setTownshipToEdit] = useState<Township | undefined>()
  const [townshipToDelete, setTownshipToDelete] = useState<Township | null>(null)
  const deleteTownshipMutation = useDeleteTownship()

  function openCreateDialog() {
    setTownshipToEdit(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(township: Township) {
    setTownshipToEdit(township)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setTownshipToEdit(undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Townships</h1>
          <p className="text-sm text-muted-foreground">Delivery areas with their default delivery fee and lead time. The fee prefills order entry and can be overridden per order; the lead time sets the order's estimated delivery date.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />New township
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <EmptyState title="Could not load townships" description={readApiError(error).message ?? 'Unexpected error'} />
      ) : townships.length === 0 ? (
        <EmptyState title="No townships configured" description="Create a township and set its default delivery fee before registering orders." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Township</TableHead>
                <TableHead>Default delivery fee</TableHead>
                <TableHead>Lead time</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {townships.map((township) => (
                <TableRow key={township.id}>
                  <TableCell className="font-medium">{township.name}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatDecimalAmount(township.defaultDeliveryFee)}</TableCell>
                  <TableCell className="tabular-nums">{township.leadTimeDays} {township.leadTimeDays === 1 ? 'day' : 'days'}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${township.name}`}
                            onClick={() => openEditDialog(township)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${township.name}`}
                            onClick={() => setTownshipToDelete(township)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TownshipDialog open={dialogOpen} township={townshipToEdit} onClose={closeDialog} />

      <DeleteConfirmDialog
        open={townshipToDelete !== null}
        onClose={() => setTownshipToDelete(null)}
        title="Delete township?"
        description={`This removes ${townshipToDelete?.name ?? 'this township'} permanently. A township that orders already reference cannot be deleted.`}
        onConfirm={async () => {
          if (!townshipToDelete) return
          await deleteTownshipMutation.mutateAsync(townshipToDelete.id)
          toast.success('Township deleted')
        }}
      />
    </div>
  )
}
