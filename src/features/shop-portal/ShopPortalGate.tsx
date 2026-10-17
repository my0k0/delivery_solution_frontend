import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth.store'

export function ShopPortalGate() {
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const location = useLocation()

  if (user?.role !== 'SHOP' || !hasPermission('shop-portal.read')) {
    return <Navigate to="/403" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function OfficeUserGate() {
  const user = useAuthStore((state) => state.user)

  if (user?.role === 'SHOP') return <Navigate to="/shop" replace />
  return <Outlet />
}
