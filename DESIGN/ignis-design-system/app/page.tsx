import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCards } from "@/components/stats-cards"
import { DashboardWaitingQueue } from "@/components/dashboard-waiting-queue"
import { UpcomingAppointments } from "@/components/upcoming-appointments"
import { QuickActions } from "@/components/quick-actions"
import { PatientTable } from "@/components/patient-table" // Import PatientTable

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader 
        title="Dashboard" 
        description="Willkommen zurück, Dr. Schmidt" 
      />
      
      <main className="flex-1 space-y-6 p-6">
        {/* Stats Overview */}
        <StatsCards />
        
        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Waiting Queue - Takes 2 columns */}
          <div className="lg:col-span-2">
            <DashboardWaitingQueue />
          </div>
          
          {/* Right Sidebar - Appointments and Quick Actions */}
          <div className="space-y-6">
            <UpcomingAppointments />
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  )
}
