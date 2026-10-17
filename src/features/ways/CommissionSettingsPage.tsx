import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchRiders, ridersKeys, updateRider } from '@/features/riders/api'
import { RiderCommissionOverrideDialog } from '@/features/ways/RiderCommissionOverrideDialog'
import { fetchCommissionRate, wayKeys, updateCommissionRate } from '@/features/ways/api'
import { getApiErrorMessage } from '@/lib/api/client'
import { AMOUNT_PATTERN } from '@/lib/constants'
import { usePermission } from '@/lib/auth/usePermission'

export function CommissionSettingsPage() {
  const canOverrideCommission = usePermission('ways.override_commission')
  const canUpdateRiders = usePermission('riders.update')
  const queryClient = useQueryClient()
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [rateMessage, setRateMessage] = useState('')
  const rate = useQuery({ queryKey: wayKeys.commissionRate, queryFn: fetchCommissionRate })
  const riders = useQuery({
    queryKey: ridersKeys.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchRiders({ page: 1, perPage: 100 }),
  })
  const rateMutation = useMutation({
    mutationFn: updateCommissionRate,
    onSuccess: async () => {
      setRateDraft(null)
      setRateMessage('')
      toast.success('Default commission rate updated')
      await queryClient.invalidateQueries({ queryKey: wayKeys.commissionRate })
    },
    onError: (error) => setRateMessage(getApiErrorMessage(error)),
  })

  function saveRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = rateDraft ?? rate.data?.value ?? ''
    if (!AMOUNT_PATTERN.test(value)) {
      setRateMessage('Enter a non-negative amount with up to two decimal places.')
      return
    }
    setRateMessage('')
    rateMutation.mutate({ value })
  }

  async function saveRiderOverride(riderId: string, commissionPerWayOverride: string | null) {
    await updateRider(riderId, { commissionPerWayOverride })
    toast.success('Rider commission override updated')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ridersKeys.all }),
      queryClient.invalidateQueries({ queryKey: wayKeys.all }),
    ])
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Commission settings</h1>
        <p className="text-sm text-muted-foreground">Set the default rate and optional rider-specific rates for each way.</p>
      </div>

      <section className="max-w-2xl rounded-lg border border-border bg-card p-4">
        <form onSubmit={(event) => void saveRate(event)} className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Default rate per way</h2>
            <p className="mt-1 text-sm text-muted-foreground">Existing ways keep their saved rate. This change only applies to ways created later.</p>
          </div>
          {rate.isLoading ? <div className="h-10 animate-pulse rounded-md bg-muted" aria-label="Loading commission rate" />
            : rate.isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(rate.error)}</p>
              : <div className="flex flex-col gap-2">
                <Label htmlFor="default-commission-rate">Commission per way (MMK)</Label>
                <Input id="default-commission-rate" inputMode="decimal" value={rateDraft ?? rate.data?.value ?? ''} onChange={(event) => setRateDraft(event.target.value)} disabled={!canOverrideCommission} />
              </div>}
          {rateMessage && <p role="alert" className="text-sm text-destructive">{rateMessage}</p>}
          {canOverrideCommission && <Button type="submit" className="min-h-10 w-fit" disabled={rateMutation.isPending || rate.isLoading || rate.isError}>{rateMutation.isPending ? 'Saving…' : 'Save default rate'}</Button>}
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="text-base font-semibold">Rider overrides</h2><p className="text-sm text-muted-foreground">A blank override means the rider uses the default rate for new ways.</p></div>
        {riders.isLoading ? <div className="h-40 animate-pulse rounded-lg border border-border bg-muted" aria-label="Loading rider commission settings" />
          : riders.isError ? <EmptyState title="Could not load riders" description={getApiErrorMessage(riders.error)} />
            : !riders.data?.data.length ? <EmptyState title="No riders found" description="Rider-specific commission rates will appear here." />
              : <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader><TableRow><TableHead>Rider</TableHead><TableHead>Status</TableHead><TableHead>Override per way</TableHead>{canOverrideCommission && canUpdateRiders && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                    {riders.data.data.map((rider) => <TableRow key={rider.id}>
                      <TableCell className="font-medium">{rider.name}</TableCell>
                      <TableCell>{rider.status === 'ACTIVE' ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell className="font-mono">{rider.commissionPerWayOverride ? `${rider.commissionPerWayOverride} MMK` : 'Use global rate'}</TableCell>
                      {canOverrideCommission && canUpdateRiders && <TableCell className="text-right"><RiderCommissionOverrideDialog rider={rider} onSave={(value) => saveRiderOverride(rider.id, value)} /></TableCell>}
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>}
      </section>
    </div>
  )
}
