import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import {
  CreateExamSchema,
  CreateQuestionSchema,
  SubmitAnswerSchema,
} from "@/shared/types";

interface AppEnv extends Env {
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

const app = new Hono<{ Bindings: AppEnv }>();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Auth endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Exam management endpoints
app.get("/api/exams", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE created_by = ? ORDER BY created_at DESC"
  ).bind(user.id).all();

  return c.json(results);
});

app.get("/api/exams/published", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE is_published = 1 AND (start_time IS NULL OR datetime(start_time) <= datetime('now')) AND (end_time IS NULL OR datetime(end_time) >= datetime('now')) ORDER BY created_at DESC"
  ).all();

  return c.json(results);
});

// Public exam access for students (no auth required for published exams)
app.get("/api/exams/:id", async (c) => {
  const examId = c.req.param("id");

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ?"
  ).bind(examId).first();

  if (!exam) {
    return c.json({ error: "Exam not found" }, 404);
  }

  // For authenticated users who own the exam, show everything
  const authHeader = c.req.header('Authorization') || c.req.header('Cookie');
  let user = null;
  
  try {
    if (authHeader) {
      // Try to get the user without requiring auth
      const authResult = await authMiddleware(c, async () => c.get("user"));
      user = c.get("user");
    }
  } catch (error) {
    // Ignore auth errors for public access
  }

  // If user owns the exam, show everything (even if not published)
  if (user && exam.created_by === user.id) {
    const { results: questions } = await c.env.DB.prepare(
      "SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC"
    ).bind(examId).all();

    for (const question of questions) {
      const { results: options } = await c.env.DB.prepare(
        "SELECT * FROM question_options WHERE question_id = ? ORDER BY order_index ASC"
      ).bind(question.id).all();
      
      question.options = options;
    }

    return c.json({ ...exam, questions });
  }

  // For non-owners, only show published exams
  if (!exam.is_published) {
    return c.json({ error: "Exam not found" }, 404);
  }

  // For published exams, show questions but without correct answers in options
  const { results: questions } = await c.env.DB.prepare(
    "SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC"
  ).bind(examId).all();

  for (const question of questions) {
    const { results: options } = await c.env.DB.prepare(
      "SELECT id, question_id, option_text, order_index, created_at, updated_at FROM question_options WHERE question_id = ? ORDER BY order_index ASC"
    ).bind(question.id).all();
    
    // Don't expose correct answers to students
    question.options = options.map(option => ({
      ...option,
      is_correct: false
    }));
  }

  return c.json({ ...exam, questions });
});

app.post("/api/exams", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  const body = await c.req.json();

  const validatedData = CreateExamSchema.parse(body);

  const result = await c.env.DB.prepare(
    "INSERT INTO exams (title, description, instructions, duration_minutes, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    validatedData.title,
    validatedData.description || null,
    validatedData.instructions || null,
    validatedData.duration_minutes,
    validatedData.start_time || null,
    validatedData.end_time || null,
    user.id
  ).run();

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  return c.json(exam, 201);
});

app.put("/api/exams/:id", authMiddleware, async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  const body = await c.req.json();

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ? AND created_by = ?"
  ).bind(examId, user.id).first();

  if (!exam) {
    return c.json({ error: "Exam not found or access denied" }, 404);
  }

  const validatedData = CreateExamSchema.parse(body);

  await c.env.DB.prepare(
    "UPDATE exams SET title = ?, description = ?, instructions = ?, duration_minutes = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(
    validatedData.title,
    validatedData.description || null,
    validatedData.instructions || null,
    validatedData.duration_minutes,
    validatedData.start_time || null,
    validatedData.end_time || null,
    examId
  ).run();

  const updatedExam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ?"
  ).bind(examId).first();

  return c.json(updatedExam);
});

app.put("/api/exams/:id/publish", authMiddleware, async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ? AND created_by = ?"
  ).bind(examId, user.id).first();

  if (!exam) {
    return c.json({ error: "Exam not found or access denied" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE exams SET is_published = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(examId).run();

  return c.json({ success: true });
});

app.delete("/api/exams/:id", authMiddleware, async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ? AND created_by = ?"
  ).bind(examId, user.id).first();

  if (!exam) {
    return c.json({ error: "Exam not found or access denied" }, 404);
  }

  // Delete in reverse order to maintain referential integrity
  // Delete student answers first
  await c.env.DB.prepare(
    "DELETE FROM student_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = ?)"
  ).bind(examId).run();

  // Delete exam attempts
  await c.env.DB.prepare(
    "DELETE FROM exam_attempts WHERE exam_id = ?"
  ).bind(examId).run();

  // Delete question options
  await c.env.DB.prepare(
    "DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE exam_id = ?)"
  ).bind(examId).run();

  // Delete questions
  await c.env.DB.prepare(
    "DELETE FROM questions WHERE exam_id = ?"
  ).bind(examId).run();

  // Delete exam
  await c.env.DB.prepare(
    "DELETE FROM exams WHERE id = ?"
  ).bind(examId).run();

  return c.json({ success: true });
});

// Question management endpoints
app.post("/api/exams/:examId/questions", authMiddleware, async (c) => {
  const examId = c.req.param("examId");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  const body = await c.req.json();

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ? AND created_by = ?"
  ).bind(examId, user.id).first();

  if (!exam) {
    return c.json({ error: "Exam not found or access denied" }, 404);
  }

  const validatedData = CreateQuestionSchema.parse(body);

  // Get the next order index
  const { order_index } = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(order_index), -1) + 1 as order_index FROM questions WHERE exam_id = ?"
  ).bind(examId).first() as { order_index: number };

  const questionResult = await c.env.DB.prepare(
    "INSERT INTO questions (exam_id, question_text, question_type, marks, order_index) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    examId,
    validatedData.question_text,
    validatedData.question_type,
    validatedData.marks,
    order_index
  ).run();

  const questionId = questionResult.meta.last_row_id;

  // Insert options
  for (let i = 0; i < validatedData.options.length; i++) {
    const option = validatedData.options[i];
    await c.env.DB.prepare(
      "INSERT INTO question_options (question_id, option_text, is_correct, order_index) VALUES (?, ?, ?, ?)"
    ).bind(questionId, option.option_text, option.is_correct ? 1 : 0, i).run();
  }

  // Update exam total marks
  const { total_marks } = await c.env.DB.prepare(
    "SELECT SUM(marks) as total_marks FROM questions WHERE exam_id = ?"
  ).bind(examId).first() as { total_marks: number };

  await c.env.DB.prepare(
    "UPDATE exams SET total_marks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(total_marks, examId).run();

  const question = await c.env.DB.prepare(
    "SELECT * FROM questions WHERE id = ?"
  ).bind(questionId).first();

  const { results: options } = await c.env.DB.prepare(
    "SELECT * FROM question_options WHERE question_id = ? ORDER BY order_index ASC"
  ).bind(questionId).all();

  return c.json({ ...question, options }, 201);
});

// Exam attempt endpoints
app.post("/api/exams/:id/start", authMiddleware, async (c) => {
  const examId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ? AND is_published = 1"
  ).bind(examId).first();

  if (!exam) {
    return c.json({ error: "Exam not found or not published" }, 404);
  }

  // Check if user already has an active attempt
  const existingAttempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ? AND is_completed = 0"
  ).bind(examId, user.id).first();

  if (existingAttempt) {
    return c.json({ error: "You already have an active attempt for this exam" }, 400);
  }

  const result = await c.env.DB.prepare(
    "INSERT INTO exam_attempts (exam_id, user_id, total_marks) VALUES (?, ?, ?)"
  ).bind(examId, user.id, exam.total_marks).run();

  const attempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  return c.json(attempt, 201);
});

app.post("/api/attempts/:id/answers", authMiddleware, async (c) => {
  const attemptId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  const body = await c.req.json();

  const attempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ? AND user_id = ? AND is_completed = 0"
  ).bind(attemptId, user.id).first();

  if (!attempt) {
    return c.json({ error: "Attempt not found or already completed" }, 404);
  }

  const validatedData = SubmitAnswerSchema.parse(body);

  // Check if answer already exists
  const existingAnswer = await c.env.DB.prepare(
    "SELECT * FROM student_answers WHERE attempt_id = ? AND question_id = ?"
  ).bind(attemptId, validatedData.question_id).first();

  // Get the correct answer to check if submitted answer is correct
  const correctOption = await c.env.DB.prepare(
    "SELECT * FROM question_options WHERE question_id = ? AND is_correct = 1"
  ).bind(validatedData.question_id).first();

  const question = await c.env.DB.prepare(
    "SELECT * FROM questions WHERE id = ?"
  ).bind(validatedData.question_id).first();
  
  if (!question) {
    return c.json({ error: "Question not found" }, 404);
  }

  const isCorrect = correctOption && validatedData.selected_option_id === correctOption.id;
  const marksAwarded = isCorrect ? question.marks : 0;

  if (existingAnswer) {
    // Update existing answer
    await c.env.DB.prepare(
      "UPDATE student_answers SET selected_option_id = ?, answer_text = ?, is_correct = ?, marks_awarded = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(
      validatedData.selected_option_id || null,
      validatedData.answer_text || null,
      isCorrect ? 1 : 0,
      marksAwarded,
      existingAnswer.id
    ).run();
  } else {
    // Create new answer
    await c.env.DB.prepare(
      "INSERT INTO student_answers (attempt_id, question_id, selected_option_id, answer_text, is_correct, marks_awarded) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      attemptId,
      validatedData.question_id,
      validatedData.selected_option_id || null,
      validatedData.answer_text || null,
      isCorrect ? 1 : 0,
      marksAwarded
    ).run();
  }

  return c.json({ success: true });
});

app.post("/api/attempts/:id/submit", authMiddleware, async (c) => {
  const attemptId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const attempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ? AND user_id = ? AND is_completed = 0"
  ).bind(attemptId, user.id).first();

  if (!attempt) {
    return c.json({ error: "Attempt not found or already completed" }, 404);
  }

  // Calculate total score
  const { total_score } = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(marks_awarded), 0) as total_score FROM student_answers WHERE attempt_id = ?"
  ).bind(attemptId).first() as { total_score: number };

  // Calculate time taken
  const startTime = new Date(attempt.start_time as string);
  const endTime = new Date();
  const timeTakenMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  await c.env.DB.prepare(
    "UPDATE exam_attempts SET score = ?, is_completed = 1, end_time = CURRENT_TIMESTAMP, time_taken_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(total_score, timeTakenMinutes, attemptId).run();

  const completedAttempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ?"
  ).bind(attemptId).first();

  return c.json(completedAttempt);
});

app.get("/api/attempts/:id/results", authMiddleware, async (c) => {
  const attemptId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const attempt = await c.env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?"
  ).bind(attemptId, user.id).first();

  if (!attempt) {
    return c.json({ error: "Attempt not found" }, 404);
  }

  const exam = await c.env.DB.prepare(
    "SELECT * FROM exams WHERE id = ?"
  ).bind(attempt.exam_id).first();

  const { results: answers } = await c.env.DB.prepare(
    "SELECT * FROM student_answers WHERE attempt_id = ?"
  ).bind(attemptId).all();

  return c.json({
    ...attempt,
    exam,
    answers
  });
});

export default app;
