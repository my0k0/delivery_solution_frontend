import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth.store'
import { Can, ProtectedRoute, RequireAuth } from './gate'

const OFFICER = {
  id: 'officer-id',
  name: 'Officer',
  email: 'officer@delivery.local',
  phone: null,
  roleId: 'role-officer',
  role: 'OFFICER',
  shopId: null,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function Bootstrapped({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('Can', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(OFFICER, ['users.read'], 'abc')
  })

  it('renders children when the permission is held', () => {
    render(
      <Bootstrapped>
        <Can name="users.read">
          <span>visible</span>
        </Can>
      </Bootstrapped>,
    )
    expect(screen.getByText('visible')).toBeInTheDocument()
  })

  it('renders nothing when the permission is missing', () => {
    render(
      <Bootstrapped>
        <Can name="roles.create">
          <span>hidden</span>
        </Can>
      </Bootstrapped>,
    )
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  it('redirects to /403 when the caller lacks the permission', () => {
    useAuthStore.getState().setSession(OFFICER, [], 'abc')
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<ProtectedRoute perm="roles.read" />}>
            <Route path="/secret" element={<span>secret</span>} />
          </Route>
          <Route path="/403" element={<span>forbidden</span>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('forbidden')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children when the permission is held', () => {
    useAuthStore.getState().setSession(OFFICER, ['roles.read'], 'abc')
    render(
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<ProtectedRoute perm="roles.read" />}>
            <Route path="/secret" element={<span>secret</span>} />
          </Route>
          <Route path="/403" element={<span>forbidden</span>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  it('redirects to /login when no token', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/home" element={<span>home</span>} />
          </Route>
          <Route path="/login" element={<span>login</span>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
  })
})
