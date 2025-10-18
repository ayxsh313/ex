import z from "zod";

// Exam schemas
export const ExamSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  instructions: z.string().nullable(),
  duration_minutes: z.number(),
  total_marks: z.number(),
  is_published: z.boolean(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateExamSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

// Question schemas
export const QuestionOptionSchema = z.object({
  id: z.number(),
  question_id: z.number(),
  option_text: z.string(),
  is_correct: z.boolean(),
  order_index: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const QuestionSchema = z.object({
  id: z.number(),
  exam_id: z.number(),
  question_text: z.string(),
  question_type: z.string(),
  marks: z.number(),
  order_index: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  options: z.array(QuestionOptionSchema).optional(),
});

export const CreateQuestionSchema = z.object({
  question_text: z.string().min(1, "Question text is required"),
  question_type: z.enum(["multiple_choice", "true_false"]),
  marks: z.number().min(1, "Marks must be at least 1"),
  options: z.array(z.object({
    option_text: z.string().min(1, "Option text is required"),
    is_correct: z.boolean(),
  })).min(2, "At least 2 options are required"),
});

// Exam attempt schemas
export const ExamAttemptSchema = z.object({
  id: z.number(),
  exam_id: z.number(),
  user_id: z.string(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  score: z.number(),
  total_marks: z.number(),
  is_completed: z.boolean(),
  time_taken_minutes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StudentAnswerSchema = z.object({
  id: z.number(),
  attempt_id: z.number(),
  question_id: z.number(),
  selected_option_id: z.number().nullable(),
  answer_text: z.string().nullable(),
  is_correct: z.boolean(),
  marks_awarded: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SubmitAnswerSchema = z.object({
  question_id: z.number(),
  selected_option_id: z.number().optional(),
  answer_text: z.string().optional(),
});

// Type exports
export type Exam = z.infer<typeof ExamSchema>;
export type CreateExam = z.infer<typeof CreateExamSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type CreateQuestion = z.infer<typeof CreateQuestionSchema>;
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type ExamAttempt = z.infer<typeof ExamAttemptSchema>;
export type StudentAnswer = z.infer<typeof StudentAnswerSchema>;
export type SubmitAnswer = z.infer<typeof SubmitAnswerSchema>;

// Extended types for API responses
export type ExamWithQuestions = Exam & {
  questions: Question[];
};

export type QuestionWithOptions = Question & {
  options: QuestionOption[];
};

export type ExamAttemptWithDetails = ExamAttempt & {
  exam: Exam;
  answers: StudentAnswer[];
};
