import { http } from '@/lib/api/client'
import type { components, operations } from '@/types/api'

export type OrderReportQuery = Omit<
  operations['ReportsController_getOrders_v1']['parameters']['query'],
  'page' | 'perPage'
> & { page: number; perPage: number }
export type OrderReportExportQuery = operations['ReportsController_exportOrders_v1']['parameters']['query']
export type ShopStatementQuery = operations['ReportsController_getShopStatement_v1']['parameters']['query']
export type ShopStatementExportQuery = operations['ReportsController_exportShopStatement_v1']['parameters']['query']
export type RiderReportQuery = operations['ReportsController_getRiderCollection_v1']['parameters']['query']
export type RiderCollectionExportQuery = operations['ReportsController_exportRiderCollection_v1']['parameters']['query']
export type RiderPayoutExportQuery = operations['ReportsController_exportRiderPayout_v1']['parameters']['query']
export type OfficeDashboardQuery = operations['ReportsController_getOfficeDashboard_v1']['parameters']['query']

export type OrderReport = components['schemas']['OrderReportResponseDto']
export type OrderReportRow = components['schemas']['OrderReportRowDto']
export type ShopStatement = components['schemas']['ShopStatementResponseDto']
export type RiderCollectionReport = components['schemas']['RiderCollectionResponseDto']
export type RiderPayoutReport = components['schemas']['RiderPayoutResponseDto']
export type OfficeDashboard = components['schemas']['OfficeDashboardResponseDto']
export type RiderDashboard = components['schemas']['RiderDashboardResponseDto']

export const reportKeys = {
  all: ['reports'] as const,
  orderReport: (query: OrderReportQuery) => ['reports', 'orders', query] as const,
  shopStatement: (query: ShopStatementQuery) => ['reports', 'shop-statement', query] as const,
  riderCollection: (query: RiderReportQuery) => ['reports', 'rider-collection', query] as const,
  riderPayout: (query: RiderReportQuery) => ['reports', 'rider-payout', query] as const,
  officeDashboard: (query: OfficeDashboardQuery) => ['reports', 'office-dashboard', query] as const,
  riderDashboard: ['reports', 'rider-dashboard'] as const,
}

export async function fetchOrderReport(query: OrderReportQuery): Promise<OrderReport> {
  return (await http.get<OrderReport>('/reports/orders', { params: query })).data
}

export async function fetchShopStatement(query: ShopStatementQuery): Promise<ShopStatement> {
  return (await http.get<ShopStatement>('/reports/shop-statement', { params: query })).data
}

export async function fetchRiderCollection(query: RiderReportQuery): Promise<RiderCollectionReport> {
  return (await http.get<RiderCollectionReport>('/reports/rider-collection', { params: query })).data
}

export async function fetchRiderPayout(query: RiderReportQuery): Promise<RiderPayoutReport> {
  return (await http.get<RiderPayoutReport>('/reports/rider-payout', { params: query })).data
}

export async function fetchOfficeDashboard(query: OfficeDashboardQuery): Promise<OfficeDashboard> {
  return (await http.get<OfficeDashboard>('/reports/office-dashboard', { params: query })).data
}

export async function fetchRiderDashboard(): Promise<RiderDashboard> {
  return (await http.get<RiderDashboard>('/riders/me/dashboard')).data
}

export async function downloadReportFile(url: string, parameters: Record<string, string>): Promise<void> {
  const response = await http.get<Blob>(url, { params: parameters, responseType: 'blob' })
  const contentDisposition = response.headers['content-disposition'] as string | undefined
  const filenameMatch = contentDisposition?.match(/filename\*?=(?:UTF-8''|")?([^;"]+)/i)
  const filename = filenameMatch?.[1]?.trim() ?? `delivery-report.${parameters.format ?? 'csv'}`
  const blobUrl = URL.createObjectURL(response.data)
  const downloadLink = document.createElement('a')
  downloadLink.href = blobUrl
  downloadLink.download = decodeURIComponent(filename.replaceAll('"', ''))
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(blobUrl)
}
