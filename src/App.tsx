import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth.store'
import { firstAllowedPath } from '@/config/navigation'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, ProtectedRoute } from '@/lib/auth/gate'
import { AuthBootstrap } from '@/lib/auth/AuthBootstrap'
import { LoginPage } from '@/features/auth/LoginPage'
import { UsersPage } from '@/features/users/UsersPage'
import { RolesPage } from '@/features/roles/RolesPage'
import { PermissionsPage } from '@/features/permissions/PermissionsPage'
import { ChangePasswordPage } from '@/features/settings/ChangePasswordPage'
import { ForbiddenPage } from '@/features/errors/ForbiddenPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { ShopsPage } from '@/features/shops/ShopsPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { RidersPage } from '@/features/riders/RidersPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { OrderDetailPage } from '@/features/orders/OrderDetailPage'
import { ApprovalQueuePage } from '@/features/orders/ApprovalQueuePage'
import { TownshipsPage } from '@/features/townships/TownshipsPage'
import { DeliveryPartnersPage } from '@/features/partners/DeliveryPartnersPage'
import { RiderBoardPage } from '@/features/riders/RiderBoardPage'
import { WaysPage } from '@/features/ways/WaysPage'
import { WayDetailPage } from '@/features/ways/WayDetailPage'
import { CommissionSettingsPage } from '@/features/ways/CommissionSettingsPage'
import { OfficeDashboardPage } from '@/features/reports/OfficeDashboardPage'
import { OrdersReportPage } from '@/features/reports/OrdersReportPage'
import { ShopStatementPage as OfficeShopStatementPage } from '@/features/reports/ShopStatementPage'
import { RiderCollectionPage } from '@/features/reports/RiderCollectionPage'
import { RiderPayoutPage } from '@/features/reports/RiderPayoutPage'
import { RiderDashboardPage } from '@/features/riders/RiderDashboardPage'
import { OfficeUserGate, ShopPortalGate } from '@/features/shop-portal/ShopPortalGate'
import { ShopLayout } from '@/features/shop-portal/ShopLayout'
import { ShopDashboardPage } from '@/features/shop-portal/ShopDashboardPage'
import { ShopOrdersPage } from '@/features/shop-portal/ShopOrdersPage'
import { ShopOrderDetailPage } from '@/features/shop-portal/ShopOrderDetailPage'
import { ShopStatementPage } from '@/features/shop-portal/ShopStatementPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only on 5xx or network errors — a 403/404 won't be hammered 3x.
      retry: (_count, err) => {
        const status = (err as AxiosError).response?.status
        return status == null || status >= 500
      },
      staleTime: 10_000,
    },
  },
})

function RedirectToFirst() {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const user = useAuthStore((state) => state.user)
  if (user?.role === 'SHOP') return <Navigate to="/shop" replace />
  return <Navigate to={firstAllowedPath(hasPermission)} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root lands on the first destination the caller can open. */}
      <Route
        path="/"
        element={
          <RedirectToFirst />
        }
      />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected shell — restore session on boot, then require token */}
      <Route element={<AuthBootstrap />}>
        <Route element={<RequireAuth />}>
          <Route element={<ShopPortalGate />}>
            <Route element={<ShopLayout />}>
              <Route path="/shop" element={<ShopDashboardPage />} />
              <Route path="/shop/orders" element={<ShopOrdersPage />} />
              <Route path="/shop/orders/:orderId" element={<ShopOrderDetailPage />} />
              <Route path="/shop/statement" element={<ShopStatementPage />} />
            </Route>
          </Route>
          <Route element={<OfficeUserGate />}>
            <Route element={<AppShell />}>
            <Route element={<ProtectedRoute perm="reports.read" />}><Route path="/dashboard" element={<OfficeDashboardPage />} /></Route>
            <Route element={<ProtectedRoute perm="reports.read" />}><Route path="/reports/orders" element={<OrdersReportPage />} /></Route>
            <Route element={<ProtectedRoute perm="reports.read" />}><Route path="/reports/shop-statement" element={<OfficeShopStatementPage />} /></Route>
            <Route element={<ProtectedRoute perm="reports.read" />}><Route path="/reports/rider-collection" element={<RiderCollectionPage />} /></Route>
            <Route element={<ProtectedRoute perm="reports.read" />}><Route path="/reports/rider-payout" element={<RiderPayoutPage />} /></Route>
            <Route element={<ProtectedRoute perm="deliveries.read" />}><Route path="/rider-dashboard" element={<RiderDashboardPage />} /></Route>
            <Route element={<ProtectedRoute perm="users.read" />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route element={<ProtectedRoute perm="roles.read" />}>
              <Route path="/roles" element={<RolesPage />} />
            </Route>
            <Route element={<ProtectedRoute perm="permissions.read" />}>
              <Route path="/permissions" element={<PermissionsPage />} />
            </Route>
            <Route element={<ProtectedRoute perm="shops.read" />}><Route path="/shops" element={<ShopsPage />} /></Route>
            <Route element={<ProtectedRoute perm="customers.read" />}><Route path="/customers" element={<CustomersPage />} /></Route>
            <Route element={<ProtectedRoute perm="riders.read" />}><Route path="/riders" element={<RidersPage />} /></Route>
            <Route element={<ProtectedRoute perm="orders.read" />}><Route path="/orders" element={<OrdersPage />} /></Route>
            <Route element={<ProtectedRoute perm="orders.read" />}><Route path="/orders/approval" element={<ApprovalQueuePage />} /></Route>
            <Route element={<ProtectedRoute perm="orders.read" />}><Route path="/orders/:orderId" element={<OrderDetailPage />} /></Route>
            <Route element={<ProtectedRoute perm="townships.read" />}><Route path="/townships" element={<TownshipsPage />} /></Route>
            <Route element={<ProtectedRoute perm="partners.read" />}><Route path="/partners" element={<DeliveryPartnersPage />} /></Route>
            <Route element={<ProtectedRoute perm="deliveries.read" />}><Route path="/rider-board" element={<RiderBoardPage />} /></Route>
            <Route element={<ProtectedRoute perm="ways.read" />}><Route path="/ways" element={<WaysPage />} /></Route>
            <Route element={<ProtectedRoute perm="ways.read" />}><Route path="/ways/settings" element={<CommissionSettingsPage />} /></Route>
            <Route element={<ProtectedRoute perm="ways.read" />}><Route path="/ways/:wayId" element={<WayDetailPage />} /></Route>
            <Route path="/settings/password" element={<ChangePasswordPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
