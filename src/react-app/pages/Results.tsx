import { useAuth } from "@getmocha/users-service/react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Header from "@/react-app/components/Header";
import { 
  Trophy, 
  Clock, 
  Target, 
  CheckCircle, 
  XCircle, 
  Share2,
  Award,
  BarChart3
} from "lucide-react";
import type { ExamAttemptWithDetails, QuestionWithOptions } from "@/shared/types";

export default function Results() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [results, setResults] = useState<ExamAttemptWithDetails | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchResults();
    }
  }, [id, user]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/attempts/${id}/results`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setResults(data);
        
        // Fetch exam questions for detailed review
        const examResponse = await fetch(`/api/exams/${data.exam_id}`, {
          credentials: "include",
        });
        if (examResponse.ok) {
          const examData = await examResponse.json();
          setQuestions(examData.questions);
        }
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching results:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = () => {
    if (!results) return 0;
    return Math.round((results.score / results.total_marks) * 100);
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: "A+", color: "text-green-600", bg: "bg-green-100" };
    if (percentage >= 80) return { grade: "A", color: "text-green-600", bg: "bg-green-100" };
    if (percentage >= 70) return { grade: "B", color: "text-blue-600", bg: "bg-blue-100" };
    if (percentage >= 60) return { grade: "C", color: "text-yellow-600", bg: "bg-yellow-100" };
    if (percentage >= 50) return { grade: "D", color: "text-orange-600", bg: "bg-orange-100" };
    return { grade: "F", color: "text-red-600", bg: "bg-red-100" };
  };

  const getAnswerForQuestion = (questionId: number) => {
    return results?.answers.find(answer => answer.question_id === questionId);
  };

  const getSelectedOption = (questionId: number) => {
    const answer = getAnswerForQuestion(questionId);
    if (!answer || !answer.selected_option_id) return null;
    
    const question = questions.find(q => q.id === questionId);
    return question?.options?.find(opt => opt.id === answer.selected_option_id);
  };

  

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const shareResults = () => {
    const percentage = getPercentage();
    const text = `I just completed "${results?.exam.title}" and scored ${results?.score}/${results?.total_marks} (${percentage}%)! 🎉`;
    
    if (navigator.share) {
      navigator.share({
        title: "Exam Results",
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert("Results copied to clipboard!");
    }
  };

  if (isPending || !user || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Results Not Found</h1>
          <p className="text-gray-600 mb-6">The exam results you're looking for don't exist or you don't have permission to view them.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const percentage = getPercentage();
  const gradeInfo = getGrade(percentage);
  const correctAnswers = results.answers.filter(answer => answer.is_correct).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className={`w-20 h-20 rounded-full ${gradeInfo.bg} flex items-center justify-center`}>
                <Trophy className={`w-10 h-10 ${gradeInfo.color}`} />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Completed!</h1>
            <h2 className="text-xl text-gray-600 mb-4">{results.exam.title}</h2>
            <div className="flex items-center justify-center space-x-4">
              <div className={`px-4 py-2 rounded-lg ${gradeInfo.bg}`}>
                <span className={`text-2xl font-bold ${gradeInfo.color}`}>
                  {gradeInfo.grade}
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {results.score}/{results.total_marks}
              </div>
              <div className={`px-4 py-2 rounded-lg ${gradeInfo.bg}`}>
                <span className={`text-xl font-semibold ${gradeInfo.color}`}>
                  {percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-blue-900">Correct Answers</h3>
              <p className="text-2xl font-bold text-blue-800">{correctAnswers}/{questions.length}</p>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg text-center">
              <Award className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-green-900">Score</h3>
              <p className="text-2xl font-bold text-green-800">{results.score}/{results.total_marks}</p>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-lg text-center">
              <BarChart3 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-purple-900">Percentage</h3>
              <p className="text-2xl font-bold text-purple-800">{percentage}%</p>
            </div>
            
            <div className="bg-orange-50 p-6 rounded-lg text-center">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-orange-900">Time Taken</h3>
              <p className="text-2xl font-bold text-orange-800">{formatTime(results.time_taken_minutes)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center mt-8">
            <button
              onClick={shareResults}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Results</span>
            </button>
          </div>
        </div>

        {/* Detailed Review */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Detailed Review</h2>
          
          <div className="space-y-8">
            {questions.map((question, index) => {
              const answer = getAnswerForQuestion(question.id);
              const selectedOption = getSelectedOption(question.id);
              
              const isCorrect = answer?.is_correct || false;

              return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded">
                          Q{index + 1}
                        </span>
                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded">
                          {question.marks} mark{question.marks !== 1 ? 's' : ''}
                        </span>
                        <div className={`flex items-center space-x-1 px-3 py-1 rounded ${
                          isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {isCorrect ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium">
                            {isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {question.question_text}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {question.options?.map((option, optionIndex) => {
                      const isSelected = selectedOption?.id === option.id;
                      const isCorrectOption = option.is_correct;
                      
                      let bgColor = "bg-gray-50";
                      let borderColor = "border-gray-200";
                      let textColor = "text-gray-700";
                      
                      if (isCorrectOption) {
                        bgColor = "bg-green-50";
                        borderColor = "border-green-200";
                        textColor = "text-green-800";
                      } else if (isSelected && !isCorrect) {
                        bgColor = "bg-red-50";
                        borderColor = "border-red-200";
                        textColor = "text-red-800";
                      }

                      return (
                        <div
                          key={option.id}
                          className={`flex items-center space-x-3 p-4 rounded-lg border ${bgColor} ${borderColor}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-current" : "border-gray-300"
                          }`}>
                            {isSelected && (
                              <div className={`w-3 h-3 rounded-full ${
                                isCorrect ? "bg-green-600" : "bg-red-600"
                              }`}></div>
                            )}
                            {isCorrectOption && !isSelected && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <span className={`flex-1 ${textColor} ${isSelected ? "font-medium" : ""}`}>
                            {String.fromCharCode(65 + optionIndex)}. {option.option_text}
                          </span>
                          {isCorrectOption && (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                              Correct
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                              Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!answer && (
                    <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Not Answered:</strong> You didn't select an answer for this question.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
