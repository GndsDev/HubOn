import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('application routes', () => {
  it('exposes the simplified operational modules', () => {
    const paths = routes.map((route) => route.path);
    expect(paths).toContain('comandas');
    expect(paths).toContain('balcao');
    expect(paths).toContain('historico');
    expect(paths).toContain('stock');
    expect(paths).toContain('despesas');
  });

  it('does not expose removed order and kitchen modules', () => {
    const paths = routes.map((route) => route.path);
    expect(paths).not.toContain('pedidos');
    expect(paths).not.toContain('cozinha');
  });
});
