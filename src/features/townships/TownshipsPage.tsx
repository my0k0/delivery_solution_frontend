import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { usePermission } from '@/lib/auth/usePermission'
import { readApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatDecimalAmount } from '@/lib/utils'
import { TownshipDialog } from './components/TownshipDialog'
import { useTownships, type Township } from './api'

export function TownshipsPage() {
  const { data: townships = [], isLoading, isError, error } = useTownships()
  const canCreate = usePermission('townships.create')
  const canUpdate = usePermission('townships.update')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [townshipToEdit, setTownshipToEdit] = useState<Township | undefined>()

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
          <p className="text-sm text-muted-foreground">Delivery areas and their default delivery fee. The fee prefills order entry and can be overridden per order.</p>
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
                {canUpdate && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {townships.map((township) => (
                <TableRow key={township.id}>
                  <TableCell className="font-medium">{township.name}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatDecimalAmount(township.defaultDeliveryFee)}</TableCell>
                  {canUpdate && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${township.name}`}
                        onClick={() => openEditDialog(township)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TownshipDialog open={dialogOpen} township={townshipToEdit} onClose={closeDialog} />
    </div>
  )
}
