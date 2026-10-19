import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface HandoverBalancesToolbarProps {
  searchInput: string
  outstandingOnlyInput: boolean
  hasFilters: boolean
  hasPendingChanges: boolean
  onSearchInputChange: (value: string) => void
  onOutstandingOnlyChange: (value: boolean) => void
  onApply: () => void
  onReset: () => void
}

/**
 * Balances toolbar: rider search + "only riders who still owe" + Apply/Reset.
 *
 * Both controls commit on Apply rather than on change — the search is free text,
 * and one rule for the pair keeps the two from behaving differently for no reason.
 */
export function HandoverBalancesToolbar({
  searchInput,
  outstandingOnlyInput,
  hasFilters,
  hasPendingChanges,
  onSearchInputChange,
  onOutstandingOnlyChange,
  onApply,
  onReset,
}: HandoverBalancesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply()
          }}
          placeholder="Search riders..."
          className="w-64 pl-9"
          aria-label="Search riders by name"
        />
      </div>

      <div className="flex min-h-10 items-center gap-2">
        <Checkbox
          id="handover-outstanding-only"
          checked={outstandingOnlyInput}
          onCheckedChange={(checked) => onOutstandingOnlyChange(checked === true)}
        />
        <Label htmlFor="handover-outstanding-only" className="font-normal">
          Only riders who still owe
        </Label>
      </div>

      <Button variant="outline" onClick={onApply} disabled={!hasPendingChanges}>
        Apply
      </Button>
      {hasFilters && (
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
