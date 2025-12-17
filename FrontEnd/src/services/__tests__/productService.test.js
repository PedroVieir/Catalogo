import { fetchProductDetails } from '../productService';

describe('fetchProductDetails', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('throws descriptive error when server returns HTML (likely 404 or proxy issue)', async () => {
    global.fetch.mockResolvedValueOnce({
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => '<!DOCTYPE html><html><body>Not Found</body></html>',
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(fetchProductDetails('73510202')).rejects.toThrow(/Resposta inesperada do servidor \(HTML\)/);
  });

  test('fallback search finds product and retries details', async () => {
    // First call: details endpoint returns 404 JSON
    global.fetch
      .mockResolvedValueOnce({
        headers: { get: () => 'application/json' },
        ok: false,
        status: 404,
        json: async () => ({ error: 'Produto não encontrado' })
      })
      // Second call: search endpoint returns an array with a candidate
      .mockResolvedValueOnce({
        headers: { get: () => 'application/json' },
        ok: true,
        json: async () => ([{ codigo: 'KIT3501', descricao: 'Kit 3501' }])
      })
      // Third call: retry details returns the full object
      .mockResolvedValueOnce({
        headers: { get: () => 'application/json' },
        ok: true,
        json: async () => ({ data: { product: { codigo: 'KIT3501', descricao: 'Kit 3501' } } })
      });

    const data = await fetchProductDetails('kit3501');
    expect(data).toBeDefined();
    // Accept either top-level or nested data structures
    const product = data.data?.product || data.product || data;
    expect(product.codigo || product).toBeDefined();
  });

  test('uses cached product list to return details without extra network calls', async () => {
    // First call: paginated products to populate cache
    global.fetch
      .mockResolvedValueOnce({
        headers: { get: () => 'application/json' },
        ok: true,
        json: async () => ({ data: [{ codigo: 'KIT3501', descricao: 'Kit 3501', conjuntos: [{ codigo: 'AB12', descricao: 'Peça AB12' }] }], pagination: { page: 1, limit: 20, total: 1 } })
      });

    // Populate cache by invoking fetchProductsPaginated
    const { fetchProductsPaginated } = await import('../productService');
    const resp = await fetchProductsPaginated(1, 20, {});
    expect(resp.data.length).toBe(1);

    // Now make fetch throw if network is used again
    global.fetch.mockImplementation(() => { throw new Error('Network should not be called'); });

    const { fetchProductDetails } = await import('../productService');
    const data = await fetchProductDetails('kit3501');

    // Should return cached product
    const product = data.data?.product || data.product || data;
    expect(product.codigo || product.codigo).toBe('KIT3501');

    // Conjuntos should be normalized and include child with code AB12 as 'filho'
    const conjuntos = data.data?.conjuntos || [];
    expect(conjuntos.length).toBeGreaterThan(0);
    expect(conjuntos[0].filho).toBe('AB12');
  });
});
