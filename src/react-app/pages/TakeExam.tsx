import { useAuth } from "@getmocha/users-service/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import Header from "@/react-app/components/Header";
import { Clock, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Flag } from "lucide-react";
import type { ExamWithQuestions, ExamAttempt, SubmitAnswer } from "@/shared/types";

export default function TakeExam() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamWithQuestions | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, SubmitAnswer>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerInitialized, setTimerInitialized] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleAutoSubmit = useCallback(async () => {
    if (!attempt || submitting) return;
    
    // Prevent multiple submissions
    setSubmitting(true);
    
    try {
      const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        alert("Time's up! Your exam has been auto-submitted.");
        navigate(`/attempts/${attempt.id}/results`);
      } else {
        throw new Error("Failed to submit exam");
      }
    } catch (error) {
      console.error("Error auto-submitting exam:", error);
      alert("Time expired! There was an error submitting your exam. Please contact support.");
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }, [attempt, navigate, submitting]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (attempt && exam) {
      // Parse start time more carefully
      let startTime: number;
      if (typeof attempt.start_time === 'string') {
        // Handle both ISO string and SQLite datetime format
        const dateStr = attempt.start_time.includes('T') ? attempt.start_time : attempt.start_time + 'Z';
        startTime = new Date(dateStr).getTime();
      } else {
        startTime = new Date(attempt.start_time).getTime();
      }
      
      const durationMs = exam.duration_minutes * 60 * 1000;
      const endTime = startTime + durationMs;
      const now = Date.now();

      console.log('Timer Setup:', {
        attemptStartTime: attempt.start_time,
        parsedStartTime: new Date(startTime).toISOString(),
        durationMinutes: exam.duration_minutes,
        durationMs,
        endTime: new Date(endTime).toISOString(),
        now: new Date(now).toISOString(),
        remainingMs: endTime - now,
        remainingMinutes: Math.floor((endTime - now) / (1000 * 60))
      });

      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        console.log('Timer Update:', {
          now: new Date(now).toISOString(),
          endTime: new Date(endTime).toISOString(),
          remaining,
          remainingMinutes: Math.floor(remaining / (1000 * 60)),
          startTimeRaw: attempt.start_time,
          startTimeParsed: new Date(startTime).toISOString(),
          timeSinceStart: now - startTime
        });
        
        setTimeRemaining(remaining);

        // Auto-submit when time is up
        if (remaining <= 0) {
          console.log('Timer expired, auto-submitting');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Use setTimeout to avoid calling handleAutoSubmit during render
          setTimeout(() => {
            handleAutoSubmit();
          }, 0);
        }
      };

      // Set initial time immediately
      updateTimer();
      setTimerInitialized(true);

      // Only start interval if there's time remaining
      if (endTime > Date.now()) {
        intervalRef.current = setInterval(updateTimer, 1000);
      } else {
        console.log('Exam time already expired on load');
        setTimeout(() => {
          handleAutoSubmit();
        }, 0);
      }

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [attempt, exam]); // Removed handleAutoSubmit from dependencies to prevent frequent re-runs

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/exams/${id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExam(data);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error fetching exam:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const startExam = async () => {
    if (!exam) return;
    
    setStarting(true);
    try {
      const response = await fetch(`/api/exams/${exam.id}/start`, {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        const attemptData = await response.json();
        setAttempt(attemptData);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to start exam");
      }
    } catch (error) {
      console.error("Error starting exam:", error);
      alert("Failed to start exam. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const saveAnswer = async (questionId: number, answer: SubmitAnswer) => {
    if (!attempt) return;

    try {
      await fetch(`/api/attempts/${attempt.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(answer),
      });
      
      setAnswers(prev => ({ ...prev, [questionId]: answer }));
    } catch (error) {
      console.error("Error saving answer:", error);
    }
  };

  const handleAnswerChange = (questionId: number, selectedOptionId: number) => {
    const answer: SubmitAnswer = {
      question_id: questionId,
      selected_option_id: selectedOptionId,
    };
    saveAnswer(questionId, answer);
  };

  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    
    // Clear the timer when manually submitting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        navigate(`/attempts/${attempt.id}/results`);
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      alert("Failed to submit exam. Please try again.");
    } finally {
      setSubmitting(false);
      setShowConfirmSubmit(false);
    }
  }, [attempt, navigate]);

  const formatTime = (milliseconds: number) => {
    if (milliseconds <= 0) return "0:00";
    
    const totalSeconds = Math.ceil(milliseconds / 1000); // Use ceil to avoid showing 0:00 prematurely
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
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
          <p className="text-gray-600 mb-6">The exam you're trying to access doesn't exist or is not available.</p>
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

  // Pre-exam instructions screen
  if (!attempt) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{exam.title}</h1>
              {exam.description && (
                <p className="text-lg text-gray-600 mb-6">{exam.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg text-center">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900">Duration</h3>
                <p className="text-blue-700">{exam.duration_minutes} minutes</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900">Questions</h3>
                <p className="text-green-700">{exam.questions.length} questions</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg text-center">
                <Flag className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900">Total Marks</h3>
                <p className="text-purple-700">{exam.total_marks} marks</p>
              </div>
            </div>

            {exam.instructions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-yellow-900 mb-3">Instructions</h3>
                <div className="text-yellow-800 whitespace-pre-wrap">{exam.instructions}</div>
              </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-red-900 mb-3">Important Notes</h3>
              <ul className="text-red-800 space-y-2">
                <li>• Once you start the exam, the timer will begin and cannot be paused</li>
                <li>• Make sure you have a stable internet connection</li>
                <li>• Your answers are saved automatically as you progress</li>
                <li>• You can navigate between questions using the navigation buttons</li>
                <li>• The exam will auto-submit when time runs out</li>
              </ul>
            </div>

            <div className="flex justify-center">
              <button
                onClick={startExam}
                disabled={starting}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {starting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                <span>{starting ? "Starting Exam..." : "Start Exam"}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === exam.questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Timer Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">{exam.title}</h2>
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {exam.questions.length}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Answered: {getAnsweredCount()}/{exam.questions.length}
              </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
                !timerInitialized ? "bg-gray-100 text-gray-800" :
                timeRemaining <= 300000 ? "bg-red-100 text-red-800 animate-pulse" : 
                timeRemaining <= 600000 ? "bg-yellow-100 text-yellow-800" : 
                "bg-blue-100 text-blue-800"
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold text-lg">
                  {!timerInitialized ? "Loading..." : formatTime(timeRemaining)}
                </span>
                <span className="text-xs">
                  {timerInitialized && timeRemaining <= 300000 ? "Time Running Out!" : 
                   timerInitialized && timeRemaining <= 600000 ? "Hurry Up!" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-lg">
                Question {currentQuestionIndex + 1}
              </span>
              <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-lg">
                {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {currentQuestion.question_text}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQuestion.options?.map((option, optionIndex) => (
                <label
                  key={option.id}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    answers[currentQuestion.id]?.selected_option_id === option.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option.id}
                    checked={answers[currentQuestion.id]?.selected_option_id === option.id}
                    onChange={() => handleAnswerChange(currentQuestion.id, option.id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-900">
                    {String.fromCharCode(65 + optionIndex)}. {option.option_text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={isFirstQuestion}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-4">
              {/* Question navigation dots */}
              <div className="flex items-center space-x-1">
                {exam.questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      index === currentQuestionIndex
                        ? "bg-blue-600 text-white"
                        : answers[exam.questions[index].id]
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              {isLastQuestion ? (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(exam.questions.length - 1, currentQuestionIndex + 1))}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Submit Exam</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your exam? You have answered{" "}
              <strong>{getAnsweredCount()}</strong> out of{" "}
              <strong>{exam.questions.length}</strong> questions.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
