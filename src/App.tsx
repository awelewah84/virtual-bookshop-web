import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { ProtectedRoute } from './app/ProtectedRoute'
import { AdminReconciliationPage } from './pages/AdminReconciliationPage'
import { AdminStockPage } from './pages/AdminStockPage'
import { CatalogPage } from './pages/CatalogPage'
import { LoginPage } from './pages/LoginPage'
import { PublicCatalogPage } from './pages/PublicCatalogPage'
import { PublicReservePage } from './pages/PublicReservePage'
import { ReservationCreatePage } from './pages/ReservationCreatePage'
import { ReservationsPage } from './pages/ReservationsPage'
import { StaffUsersPage } from './pages/StaffUsersPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PublicCatalogPage />} />
        <Route path="catalog" element={<PublicCatalogPage />} />
        <Route path="reserve" element={<PublicReservePage />} />
        <Route path="login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="admin" element={<Navigate to="/admin/catalog" replace />} />
          <Route path="admin/catalog" element={<CatalogPage />} />
          <Route path="admin/reservations" element={<ReservationsPage />} />
          <Route path="admin/reservations/new" element={<ReservationCreatePage />} />
          <Route path="admin/stock" element={<AdminStockPage />} />
          <Route path="admin/reconciliation" element={<AdminReconciliationPage />} />
          <Route path="admin/staff-users" element={<StaffUsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
