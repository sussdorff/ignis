import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import PraxisDashboard from './pages/praxis/Dashboard'
import PatientIntake from './pages/patient/Intake'
import PatientVerify from './pages/patient/Verify'
import PatientBook from './pages/patient/Book'

function App() {
  return (
    <Router basename="/app">
      <Routes>
        {/* Praxis (Clinic) Routes */}
        <Route path="/praxis" element={<PraxisDashboard />} />
        
        {/* Patient Routes */}
        <Route path="/patient/intake" element={<PatientIntake />} />
        <Route path="/patient/verify/:token" element={<PatientVerify />} />
        <Route path="/patient/book" element={<PatientBook />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/praxis" replace />} />
      </Routes>
    </Router>
  )
}

export default App
