import { describe, expect, it } from 'vitest'
import { filterAssignableRoles } from './filterAssignableRoles'
import type { UserResponseDto } from '@/types/user'
import type { components } from '@/types/api'

type Role = components['schemas']['RoleResponseDto']
type User = UserResponseDto

const SYSTEM_OWNER: Role = {
  id: 'r-owner',
  name: 'OWNER',
  description: null,
  isSystem: true,
  userCount: 1,
}
const ADMIN: Role = {
  id: 'r-admin',
  name: 'ADMIN',
  description: null,
  isSystem: false,
  userCount: 2,
}
const OFFICER: Role = {
  id: 'r-officer',
  name: 'OFFICER',
  description: null,
  isSystem: false,
  userCount: 5,
}
const RIDER: Role = {
  id: 'r-rider',
  name: 'RIDER',
  description: null,
  isSystem: false,
  userCount: 3,
}

function user(role: string): User {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 'test@delivery.local',
    phone: null,
    roleId: 'r-x',
    role,
    shopId: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

const ALL_ROLES = [SYSTEM_OWNER, ADMIN, OFFICER, RIDER]

describe('filterAssignableRoles', () => {
  it('returns [] for a null caller', () => {
    expect(filterAssignableRoles(ALL_ROLES, null)).toEqual([])
  })

  it('OWNER sees every role', () => {
    expect(filterAssignableRoles(ALL_ROLES, user('OWNER'))).toHaveLength(4)
  })

  it('ADMIN drops the system role and ADMIN itself', () => {
    const result = filterAssignableRoles(ALL_ROLES, user('ADMIN'))
    expect(result.map((role) => role.name)).toEqual(['OFFICER', 'RIDER'])
  })

  it('RIDER sees nothing', () => {
    expect(filterAssignableRoles(ALL_ROLES, user('RIDER'))).toEqual([])
  })
})
