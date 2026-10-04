export const APP_ROLES = ['staff', 'admin']

export function normalizeRole(role) {
  return APP_ROLES.includes(role) ? role : null
}

export function dashboardPath(role) {
  if (role === 'staff') return '/staff'
  if (role === 'admin') return '/admin'
  return '/login'
}

export function hasRoleAccess(role, allowedRoles) {
  return normalizeRole(role) !== null && allowedRoles.includes(role)
}

export function portalMismatchMessage(portal, actualRole) {
  if (portal === actualRole) return ''
  const article = portal === 'admin' ? 'an' : 'a'
  return `This account is not ${article} ${portal} account.`
}
