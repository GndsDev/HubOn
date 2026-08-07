export function firstAccessiblePath(roles: string[]): string {
  if (roles.includes('OWNER') || roles.includes('ADMIN')) return '/dashboard';
  if (roles.includes('WAITER')) return '/comandas';
  if (roles.includes('KITCHEN')) return '/login';
  if (roles.includes('CASHIER')) return '/balcao';
  return '/login';
}
