import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/test-env.js'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    fileParallelism: false,
    sequence: {
      files: [
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
        'tests/ecpay.test.js',
      ],
    },
    hookTimeout: 10000,
  },
});
