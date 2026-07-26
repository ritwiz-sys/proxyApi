import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MyAlertsModal from '../../components/alerts/MyAlertsModal'
import { vi,describe,test,expect } from 'vitest'

// mock api
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: {} })
  }
}))

const renderModal = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MyAlertsModal onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('MyAlertsModal', () => {

  test('renders My Alerts title', () => {
    renderModal()
    expect(screen.getByText(/My Alerts/i)).toBeInTheDocument()
  })

  test('shows Edit button', () => {
    renderModal()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  test('toggles to Done when Edit clicked', () => {
    renderModal()
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  test('shows close button', () => {
    renderModal()
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  test('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MyAlertsModal onClose={onClose} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  test('shows empty state when no alerts', async () => {
    renderModal()
    const empty = await screen.findByText(/No alerts yet/i)
    expect(empty).toBeInTheDocument()
  })

})