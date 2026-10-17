import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api/client'
import { usePermission } from '@/lib/auth/gate'
import { downloadReportFile } from '@/features/reports/api'

interface ReportExportButtonsProps {
  endpoint: string
  parameters: Record<string, string>
}

export function ReportExportButtons({ endpoint, parameters }: ReportExportButtonsProps) {
  const canExport = usePermission('reports.export')
  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') => downloadReportFile(endpoint, { ...parameters, format }),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not export this report.')),
    onSuccess: (_data, format) => toast.success(`${format.toUpperCase()} download started`),
  })
  if (!canExport) return null
  return <div className="flex flex-wrap gap-2" aria-label="Export report">
    <Button variant="outline" className="min-h-10" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('csv')}>Export CSV</Button>
    <Button variant="outline" className="min-h-10" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('xlsx')}>Export XLSX</Button>
  </div>
}
