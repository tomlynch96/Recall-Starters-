import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentTeacher } from './utils/storage.js';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LessonPage from './pages/LessonPage.jsx';
import StarterPage from './pages/StarterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import HoDPage from './pages/HoDPage.jsx';

function RequireAuth({ children }) {
  const email = getCurrentTeacher();
  if (!email) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/lesson/:classId" element={<RequireAuth><LessonPage /></RequireAuth>} />
        <Route path="/starter/:classId/:lessonOrder" element={<RequireAuth><StarterPage /></RequireAuth>} />
        <Route path="/dashboard/:classId" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/hod" element={<RequireAuth><HoDPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
