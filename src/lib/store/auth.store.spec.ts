import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth.store'

const OWNER = {
  id: 'owner-id',
  name: 'System Owner',
  email: 'owner@delivery.local',
  phone: null,
  roleId: 'role-owner',
  role: 'OWNER',
  shopId: null,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

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

describe('auth.store', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  it('starts empty and default hasPermission is false', () => {
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().hasPermission('users.read')).toBe(false)
  })

  it('setSession stores user, permissions, and token', () => {
    useAuthStore.getState().setSession(OFFICER, ['users.read'], 'abc')
    const state = useAuthStore.getState()
    expect(state.user).toEqual(OFFICER)
    expect(state.permissions).toEqual(['users.read'])
    expect(state.token).toBe('abc')
  })

  it('hasPermission checks the granted set', () => {
    useAuthStore.getState().setSession(OFFICER, ['users.read'], 'abc')
    expect(useAuthStore.getState().hasPermission('users.read')).toBe(true)
    expect(useAuthStore.getState().hasPermission('roles.create')).toBe(false)
  })

  it('OWNER holds every permission regardless of the granted set', () => {
    useAuthStore.getState().setSession(OWNER, ['users.read'], 'abc')
    expect(useAuthStore.getState().hasPermission('roles.create')).toBe(true)
    expect(useAuthStore.getState().hasPermission('users.delete')).toBe(true)
  })

  it('clearSession resets everything', () => {
    useAuthStore.getState().setSession(OFFICER, ['users.read'], 'abc')
    useAuthStore.getState().clearSession()
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.permissions).toEqual([])
    expect(state.hasPermission('users.read')).toBe(false)
  })

  it('persists to localStorage on setSession', () => {
    useAuthStore.getState().setSession(OFFICER, ['users.read'], 'abc')
    const persisted = JSON.parse(localStorage.getItem('delivery-auth') ?? '{}')
    expect(persisted.state.token).toBe('abc')
    expect(persisted.state.user.role).toBe('OFFICER')
  })
})
