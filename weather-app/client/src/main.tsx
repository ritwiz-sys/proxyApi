import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// create query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2, // retry failed requests 2 times
      staleTime: 1000 * 60 * 5, // cache data for 5 minutes
      refetchOnWindowFocus: false, // don't refetch when tab focused
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
