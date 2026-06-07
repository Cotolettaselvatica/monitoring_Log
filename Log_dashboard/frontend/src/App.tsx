import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import MachinesListPage from "@/pages/MachinesListPage";
import MachineDetailPage from "@/pages/MachineDetailPage";
import AlertsPage from "@/pages/AlertsPage";
import MaintenancePage from "@/pages/MaintenancePage";
import LogsPage from "@/pages/LogsPage";
import ReportsPage from "@/pages/ReportsPage";
import AuditPage from "@/pages/AuditPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="machines" element={<MachinesListPage />} />
        <Route path="machines/:id" element={<MachineDetailPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
