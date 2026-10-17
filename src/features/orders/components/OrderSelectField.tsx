import { Label } from '@/components/ui/label'

export interface SelectOption {
  value: string
  label: string
}

interface OrderSelectFieldProps {
  id: string
  label: string
  value: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function OrderSelectField({
  id,
  label,
  value,
  options,
  placeholder = 'Choose an option',
  disabled = false,
  onChange,
}: OrderSelectFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
