import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchRiders, type Rider } from '@/features/riders/api'
import { useShops } from '@/features/shops/api'
import { useCustomers } from '@/features/customers/api'
import {
  fetchDeliveryPartners,
  fetchTownships,
  type AssigneeType,
  type DeliveryPartner,
  type Order,
  type OrderBody,
  type UpdateOrderBody,
} from '@/features/orders/api'
import { calculateCodToCollect, calculateEstimatedDate, calculateNetOwedToShop, NET_OWED_SIGN_NOTE } from '@/features/orders/money'
import { usePermission } from '@/lib/auth/usePermission'
import { getApiErrorMessage } from '@/lib/api/client'
import { AMOUNT_PATTERN, FIELD_LIMITS } from '@/lib/constants'
import { useQuery } from '@tanstack/react-query'
import { OrderSelectField } from '@/features/orders/components/OrderSelectField'
import { TownshipChangeDialog } from '@/features/orders/TownshipChangeDialog'

interface OrderDraft {
  shopId: string
  customerId: string
  townshipId: string
  assigneeType: AssigneeType | ''
  assigneeId: string
  packagePrice: string
  deliveryFee: string
  commissionFee: string
  isPackagePaidToShop: boolean
  isFeePaidToShop: boolean
  partnerFee: string
  partnerTrackingNo: string
  estimatedDeliveryDate: string
  deliveryAddress: string
  notes: string
}

interface OrderFormProps {
  order: Order | null
  pending: boolean
  onCancel: () => void
  onSave: (body: OrderBody | UpdateOrderBody) => Promise<void>
}

function createDraft(order: Order | null): OrderDraft {
  return {
    shopId: order?.shopId ?? '',
    customerId: order?.customerId ?? '',
    townshipId: order?.townshipId ?? '',
    assigneeType: order?.assigneeType ?? '',
    assigneeId: order?.riderId ?? order?.partnerId ?? '',
    packagePrice: order?.packagePrice ?? '0.00',
    deliveryFee: order?.deliveryFee ?? '0.00',
    commissionFee: order?.commissionFee ?? '0.00',
    isPackagePaidToShop: order?.isPackagePaidToShop ?? false,
    isFeePaidToShop: order?.isFeePaidToShop ?? false,
    partnerFee: order?.partnerFee ?? '0.00',
    partnerTrackingNo: order?.partnerTrackingNo ?? '',
    estimatedDeliveryDate: order?.estimatedDeliveryDate ?? '',
    deliveryAddress: order?.deliveryAddress ?? '',
    notes: order?.notes ?? '',
  }
}

function selectOptions<T extends { id: string; name: string }>(records: T[] | undefined) {
  return (records ?? []).map((record) => ({ value: record.id, label: record.name }))
}

export function OrderForm({ order, pending, onCancel, onSave }: OrderFormProps) {
  const shops = useShops({ page: 1, perPage: 100 })
  const customers = useCustomers({ page: 1, perPage: 100 })
  const townships = useQuery({ queryKey: ['workflow-townships'], queryFn: fetchTownships })
  const riders = useQuery({ queryKey: ['operations', 'riders', 'active'], queryFn: () => fetchRiders({ page: 1, perPage: 100, status: 'ACTIVE' }) })
  const partners = useQuery({ queryKey: ['workflow-partners'], queryFn: fetchDeliveryPartners })
  const canCreateOrder = usePermission('orders.create')
  const canUpdateOrder = usePermission('orders.update')
  const canSaveOrder = order ? canUpdateOrder : canCreateOrder
  const [draft, setDraft] = useState(() => createDraft(order))
  const [pendingTownshipId, setPendingTownshipId] = useState<string | null>(null)
  const [isApplyingTownshipDefaults, setIsApplyingTownshipDefaults] = useState(false)
  const [message, setMessage] = useState('')
  const townshipOptions = selectOptions(townships.data)
  const selectedTownship = townships.data?.find((township) => township.id === draft.townshipId)
  const pendingTownship = townships.data?.find((township) => township.id === pendingTownshipId) ?? null
  /**
   * The assignee type decides which money fields apply. Commission is a rider
   * earning, so it is inert and the backend stores `'0'` for a partner order;
   * `partnerFee` and `partnerTrackingNo` are the mirror image and are inert
   * without a partner assignee.
   */
  const isPartnerOrder = draft.assigneeType === 'PARTNER'
  const moneyPreview = {
    /**
     * The preview's figures are gated on status, and this form only ever writes
     * an order that is still open — a new order starts `PENDING`, and a terminal
     * one offers no edit — so it declares an open status for the create case.
     */
    status: order?.status ?? 'PENDING',
    packagePrice: draft.packagePrice,
    deliveryFee: draft.deliveryFee,
    isPackagePaidToShop: draft.isPackagePaidToShop,
    isFeePaidToShop: draft.isFeePaidToShop,
    /**
     * An advance is never editable in this form — it is recorded and cleared
     * from the order detail page — so the preview carries whatever is already
     * recorded, and `'0'` for an order that has none.
     */
    shopAdvanceAmount: order?.shopAdvanceAmount ?? '0',
  }

  function updateDraft(changes: Partial<OrderDraft>) {
    setDraft((currentDraft) => ({ ...currentDraft, ...changes }))
  }

  function chooseTownship(townshipId: string) {
    if (!townshipId) {
      if (order && draft.townshipId) {
        setPendingTownshipId('')
        return
      }
      updateDraft({ townshipId: '', estimatedDeliveryDate: '' })
      return
    }
    const township = townships.data?.find((candidate) => candidate.id === townshipId)
    if (!township || township.id === draft.townshipId) return
    if (order) {
      setPendingTownshipId(township.id)
      return
    }
    /**
     * A township supplies money defaults and a lead time only — it never names
     * an assignee, so choosing one leaves the assignee fields untouched.
     */
    updateDraft({
      townshipId: township.id,
      deliveryFee: township.defaultDeliveryFee,
      commissionFee: township.defaultCommissionFee,
      estimatedDeliveryDate: calculateEstimatedDate(township.leadTimeDays),
    })
    setIsApplyingTownshipDefaults(true)
  }

  function confirmTownshipChange(overwriteDefaults: boolean) {
    if (pendingTownshipId === null) return
    if (pendingTownshipId === '') {
      updateDraft({ townshipId: '', estimatedDeliveryDate: '' })
      setIsApplyingTownshipDefaults(false)
      setPendingTownshipId(null)
      return
    }
    if (!pendingTownship) return
    updateDraft({
      townshipId: pendingTownship.id,
      estimatedDeliveryDate: calculateEstimatedDate(pendingTownship.leadTimeDays),
      ...(overwriteDefaults
        ? {
            deliveryFee: pendingTownship.defaultDeliveryFee,
            commissionFee: pendingTownship.defaultCommissionFee,
          }
        : {}),
    })
    setIsApplyingTownshipDefaults(overwriteDefaults)
    setPendingTownshipId(null)
  }

  function setAssignee(assigneeType: AssigneeType | '') {
    /**
     * The assignee type decides which cost fields apply. The commission follows
     * it: a partner order has none, and moving back to a rider re-fills the
     * township prefill — but only while the field still holds the untouched
     * `0.00`, so a typed value is never clobbered.
     *
     * The partner fields are the mirror image and are dropped the moment the
     * assignee stops being a partner: they are inert without one, and the API
     * stores `'0'`/`null` for anything else, so keeping a value typed for a
     * partner would only send a cost this order does not have.
     */
    updateDraft({
      assigneeType,
      assigneeId: '',
      ...(assigneeType === 'PARTNER'
        ? { commissionFee: '0.00' }
        : draft.commissionFee === '0.00' ? { commissionFee: selectedTownship?.defaultCommissionFee ?? '0.00' } : {}),
      ...(assigneeType === 'PARTNER' ? {} : { partnerFee: '0.00', partnerTrackingNo: '' }),
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (!draft.shopId || !draft.customerId) {
      setMessage('Choose both a shop and a customer.')
      return
    }
    if (
      !AMOUNT_PATTERN.test(draft.packagePrice)
      || !AMOUNT_PATTERN.test(draft.deliveryFee)
      || !AMOUNT_PATTERN.test(draft.commissionFee)
    ) {
      setMessage('Enter amounts with up to two decimal places.')
      return
    }
    if (draft.assigneeType && !draft.assigneeId) {
      setMessage('Choose an assignee or select No assignee.')
      return
    }

    const commonBody = {
      shopId: draft.shopId,
      customerId: draft.customerId,
      townshipId: draft.townshipId || null,
      packagePrice: draft.packagePrice,
      deliveryFee: draft.deliveryFee,
      commissionFee: draft.commissionFee,
      isPackagePaidToShop: draft.isPackagePaidToShop,
      isFeePaidToShop: draft.isFeePaidToShop,
      partnerFee: draft.partnerFee || '0.00',
      estimatedDeliveryDate: draft.estimatedDeliveryDate || null,
      deliveryAddress: draft.deliveryAddress || null,
      notes: draft.notes || null,
      partnerTrackingNo: draft.partnerTrackingNo || null,
    }
    const assignmentBody = draft.assigneeType === 'RIDER'
      ? { riderId: draft.assigneeId }
      : draft.assigneeType === 'PARTNER'
        ? { partnerId: draft.assigneeId }
        : { riderId: null }
    const isTownshipChanged = Boolean(order && draft.townshipId !== (order.townshipId ?? ''))
    try {
      if (order) {
        /**
         * One request means "adopt this township's money defaults", so the gate
         * covers the fee and the commission together: both must still match the
         * township, then both are left out for the API's `applyTownshipFee` to
         * supply. An edited value is sent explicitly instead.
         */
        const canUseTownshipMoneyDefault = isTownshipChanged
          && isApplyingTownshipDefaults
          && selectedTownship?.defaultDeliveryFee === draft.deliveryFee
          && selectedTownship?.defaultCommissionFee === draft.commissionFee
        const updateBody: UpdateOrderBody = {
          ...commonBody,
          ...assignmentBody,
          ...(isTownshipChanged ? {
            applyTownshipFee: canUseTownshipMoneyDefault,
          } : {}),
        }
        if (canUseTownshipMoneyDefault) {
          delete updateBody.deliveryFee
          delete updateBody.commissionFee
        }
        await onSave(updateBody)
        return
      }
      const createBody: OrderBody = {
        ...commonBody,
        ...(draft.assigneeType === 'RIDER'
          ? { riderId: draft.assigneeId }
          : draft.assigneeType === 'PARTNER'
            ? { partnerId: draft.assigneeId }
            : { riderId: null }),
      }
      await onSave(createBody)
    } catch (error) {
      setMessage(getApiErrorMessage(error))
    }
  }

  const riderRecords: Rider[] = riders.data?.data ?? []
  const partnerRecords: DeliveryPartner[] = partners.data ?? []
  const assigneeOptions = draft.assigneeType === 'RIDER'
    ? selectOptions(riderRecords)
    : selectOptions(partnerRecords.filter((partner) => partner.isActive))

  return (
    <>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <OrderSelectField id="order-shop" label="Shop" value={draft.shopId} options={selectOptions(shops.data?.data)} onChange={(shopId) => updateDraft({ shopId })} />
          <OrderSelectField id="order-customer" label="Customer" value={draft.customerId} options={selectOptions(customers.data?.data)} onChange={(customerId) => updateDraft({ customerId })} />
          <OrderSelectField id="order-township" label="Township" value={draft.townshipId} options={townshipOptions} placeholder="No township" onChange={chooseTownship} />
          <div className="grid grid-cols-2 gap-3">
            <OrderSelectField id="order-assignee-type" label="Assignee type" value={draft.assigneeType} options={[{ value: 'RIDER', label: 'Rider' }, { value: 'PARTNER', label: 'Delivery partner' }]} placeholder="No assignee" onChange={(value) => setAssignee(value as AssigneeType | '')} />
            <OrderSelectField id="order-assignee" label={draft.assigneeType === 'PARTNER' ? 'Delivery partner' : 'Rider'} value={draft.assigneeId} options={assigneeOptions} disabled={!draft.assigneeType} placeholder={draft.assigneeType ? 'Choose assignee' : 'No assignee'} onChange={(assigneeId) => updateDraft({ assigneeId })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-estimated-date">Estimated delivery date</Label>
            <Input id="order-estimated-date" type="date" value={draft.estimatedDeliveryDate} onChange={(event) => updateDraft({ estimatedDeliveryDate: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-package-price">Package price</Label>
            <Input id="order-package-price" inputMode="decimal" value={draft.packagePrice} onChange={(event) => updateDraft({ packagePrice: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-delivery-fee">Delivery fee</Label>
            <Input id="order-delivery-fee" inputMode="decimal" value={draft.deliveryFee} onChange={(event) => updateDraft({ deliveryFee: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-commission-fee">{isPartnerOrder ? 'No commission for partner deliveries' : 'Rider commission'}</Label>
            <Input id="order-commission-fee" inputMode="decimal" value={draft.commissionFee} disabled={isPartnerOrder} onChange={(event) => updateDraft({ commissionFee: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-partner-fee">{isPartnerOrder ? 'Partner fee (internal)' : 'Partner fee (internal · partner orders only)'}</Label>
            <Input id="order-partner-fee" inputMode="decimal" value={draft.partnerFee} disabled={!isPartnerOrder} onChange={(event) => updateDraft({ partnerFee: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-partner-tracking">{isPartnerOrder ? 'Partner tracking number' : 'Partner tracking number (partner orders only)'}</Label>
            <Input id="order-partner-tracking" maxLength={FIELD_LIMITS.order.partnerTrackingNo} value={draft.partnerTrackingNo} disabled={!isPartnerOrder} onChange={(event) => updateDraft({ partnerTrackingNo: event.target.value })} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="order-address">Delivery address</Label>
            <Input id="order-address" maxLength={FIELD_LIMITS.order.deliveryAddress} value={draft.deliveryAddress} onChange={(event) => updateDraft({ deliveryAddress: event.target.value })} />
          </div>
        </div>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-3 rounded-md border border-border p-3 text-sm">
          <legend className="px-1 font-medium">Already paid to shop</legend>
          <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={draft.isPackagePaidToShop} onChange={(event) => updateDraft({ isPackagePaidToShop: event.target.checked })} />Package price paid</label>
          <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={draft.isFeePaidToShop} onChange={(event) => updateDraft({ isFeePaidToShop: event.target.checked })} />Delivery fee paid</label>
        </fieldset>
        <div className="grid gap-3 rounded-md bg-muted p-3 text-sm sm:grid-cols-2">
          <p>COD to collect <strong className="font-mono">{calculateCodToCollect(moneyPreview)}</strong></p>
          <p>Net owed to shop (estimated) <strong className="font-mono">{calculateNetOwedToShop(moneyPreview)}</strong></p>
          <p className="text-xs text-muted-foreground sm:col-span-2">{NET_OWED_SIGN_NOTE}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-notes">Notes</Label>
          <textarea id="order-notes" maxLength={FIELD_LIMITS.order.notes} className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
        </div>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          {canSaveOrder && <Button type="submit" disabled={pending}>{pending ? 'Saving…' : order ? 'Save changes' : 'Create order'}</Button>}
        </div>
      </form>
      <TownshipChangeDialog
        open={pendingTownshipId !== null}
        township={pendingTownship}
        canApplyDefaults={!order || canUpdateOrder}
        onClose={() => setPendingTownshipId(null)}
        onChoose={confirmTownshipChange}
      />
    </>
  )
}
