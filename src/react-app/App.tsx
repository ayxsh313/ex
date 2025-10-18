import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import HomePage from "@/react-app/pages/Home";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import DashboardPage from "@/react-app/pages/Dashboard";
import CreateExamPage from "@/react-app/pages/CreateExam";
import ExamDetailPage from "@/react-app/pages/ExamDetail";
import TakeExamPage from "@/react-app/pages/TakeExam";
import ResultsPage from "@/react-app/pages/Results";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/exams/create" element={<CreateExamPage />} />
          <Route path="/exams/:id" element={<ExamDetailPage />} />
          <Route path="/exams/:id/take" element={<TakeExamPage />} />
          <Route path="/attempts/:id/results" element={<ResultsPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
