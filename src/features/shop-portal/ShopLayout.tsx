import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Package, Store } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'

const SHOP_NAVIGATION = [
  { to: '/shop', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/shop/orders', label: 'Orders', icon: Package, end: false },
  { to: '/shop/statement', label: 'Statement', icon: Store, end: false },
] as const

export function ShopLayout() {
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()

  function logout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-14 w-full max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
              <Store className="size-4" />
            </span>
            <span className="truncate text-sm font-semibold">Shop portal</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="max-w-40 truncate text-sm text-muted-foreground sm:max-w-none">{user?.name}</span>
            <button type="button" onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <LogOut className="size-4" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        </div>
        <nav aria-label="Shop portal" className="mx-auto flex w-full max-w-screen-2xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {SHOP_NAVIGATION.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
              <Icon className="size-4" aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl min-w-0 px-4 py-5 sm:px-6 sm:py-6">
        <Outlet />
      </main>
    </div>
  )
}
