import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',        // where tests live
  timeout: 30000,            // 30 seconds per test
  retries: 1,                // retry failed test once
  use: {
    baseURL: 'http://localhost:5000', // your backend URL
  },
  reporter: 'html'           // generates nice HTML report
})