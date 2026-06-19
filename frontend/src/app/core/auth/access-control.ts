export function firstAccessiblePath(roles: string[]): string {
  if (roles.includes('OWNER') || roles.includes('ADMIN')) return '/dashboard';
  if (roles.includes('WAITER')) return '/mesas';
  if (roles.includes('KITCHEN')) return '/cozinha';
  if (roles.includes('CASHIER')) return '/comandas';
  return '/login';
}
