import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { usePermission } from '@/lib/auth/usePermission'
import type { PermissionKey } from '@/types/permission'

/** Renders `children` only when the caller holds `name`. */
export function Can({
  name,
  children,
}: {
  name: PermissionKey
  children: ReactNode
}): ReactNode | null {
  const allowed = usePermission(name)
  return allowed ? children : null
}

/** Route-level gate: redirect to /403 when the caller lacks the permission. */
export function ProtectedRoute({ perm }: { perm: PermissionKey }) {
  const location = useLocation()
  const allowed = usePermission(perm)
  if (!allowed) {
    return <Navigate to="/403" replace state={{ from: location }} />
  }
  return <Outlet />
}

/** Wrapper for route trees that require auth (but no specific permission). */
export function RequireAuth() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
