import { useAuth } from "@getmocha/users-service/react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Header from "@/react-app/components/Header";
import { ArrowLeft, Clock, BarChart3, Eye, Calendar, Share2, Edit, Trash2 } from "lucide-react";
import type { ExamWithQuestions } from "@/shared/types";

export default function ExamDetail() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchExam();
    }
  }, [id, user]);

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/exams/${id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExam(data);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error fetching exam:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!exam) return;
    
    setPublishing(true);
    try {
      const response = await fetch(`/api/exams/${exam.id}/publish`, {
        method: "PUT",
        credentials: "include",
      });
      
      if (response.ok) {
        setExam({ ...exam, is_published: true });
      }
    } catch (error) {
      console.error("Error publishing exam:", error);
      alert("Failed to publish exam. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const copyExamLink = () => {
    const link = `${window.location.origin}/exams/${exam?.id}/take`;
    navigator.clipboard.writeText(link);
    alert("Exam link copied to clipboard!");
  };

  const handleDeleteExam = async () => {
    if (!exam) return;

    if (!window.confirm(`Are you sure you want to delete "${exam.title}"? This action cannot be undone and will also delete all associated questions, attempts, and student responses.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/exams/${exam.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        navigate("/dashboard");
      } else {
        alert("Failed to delete exam. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting exam:", error);
      alert("Failed to delete exam. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isPending || !user || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Exam Not Found</h1>
          <p className="text-gray-600 mb-6">The exam you're looking for doesn't exist or you don't have permission to view it.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Exam Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  exam.is_published 
                    ? "bg-green-100 text-green-800" 
                    : "bg-orange-100 text-orange-800"
                }`}>
                  {exam.is_published ? "Published" : "Draft"}
                </span>
              </div>
              {exam.description && (
                <p className="text-gray-600 mb-4">{exam.description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {exam.is_published ? (
                <button
                  onClick={copyExamLink}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Link</span>
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={publishing || exam.questions.length === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {publishing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span>{publishing ? "Publishing..." : "Publish Exam"}</span>
                </button>
              )}
              <button
                onClick={handleDeleteExam}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{deleting ? "Deleting..." : "Delete Exam"}</span>
              </button>
            </div>
          </div>

          {/* Exam Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Duration</p>
                  <p className="text-lg font-bold text-blue-900">{exam.duration_minutes} min</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Marks</p>
                  <p className="text-lg font-bold text-green-900">{exam.total_marks}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">Questions</p>
                  <p className="text-lg font-bold text-purple-900">{exam.questions.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-600 font-medium">Created</p>
                  <p className="text-sm font-bold text-orange-900">{formatDate(exam.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {exam.instructions && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions for Students</h3>
              <p className="text-blue-800 whitespace-pre-wrap">{exam.instructions}</p>
            </div>
          )}
        </div>

        {/* Questions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
            <button
              onClick={() => navigate(`/exams/create`)}
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
            >
              <Edit className="w-4 h-4" />
              <span>Add More Questions</span>
            </button>
          </div>

          {exam.questions.length === 0 ? (
            <div className="text-center py-8">
              <Edit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
              <p className="text-gray-600 mb-4">Add questions to make this exam available to students</p>
              <button
                onClick={() => navigate(`/exams/create`)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Questions
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {exam.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                          Q{index + 1}
                        </span>
                        <span className="bg-gray-100 text-gray-800 text-sm font-medium px-2 py-1 rounded">
                          {question.marks} mark{question.marks !== 1 ? 's' : ''}
                        </span>
                        <span className="bg-purple-100 text-purple-800 text-sm font-medium px-2 py-1 rounded capitalize">
                          {question.question_type.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {question.question_text}
                      </h3>
                    </div>
                  </div>

                  {question.options && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Answer Options:</p>
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={option.id}
                          className={`flex items-center space-x-3 p-3 rounded-lg ${
                            option.is_correct 
                              ? "bg-green-50 border border-green-200" 
                              : "bg-gray-50"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            option.is_correct 
                              ? "border-green-500 bg-green-500" 
                              : "border-gray-300"
                          }`}>
                            {option.is_correct && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <span className={`text-sm ${
                            option.is_correct 
                              ? "text-green-900 font-medium" 
                              : "text-gray-700"
                          }`}>
                            {String.fromCharCode(65 + optionIndex)}. {option.option_text}
                          </span>
                          {option.is_correct && (
                            <span className="text-xs text-green-600 font-medium">Correct Answer</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exam Link */}
        {exam.is_published && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">Exam Published!</h3>
            <p className="text-green-700 mb-4">Students can now access this exam using the link below:</p>
            <div className="flex items-center space-x-3">
              <code className="flex-1 bg-white p-3 rounded-lg border text-sm text-gray-700">
                {window.location.origin}/exams/{exam.id}/take
              </code>
              <button
                onClick={copyExamLink}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
