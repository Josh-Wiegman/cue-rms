import { ArticleQuiz } from './article.model';

export interface TrainingModule {
  id: string;
  title: string;
  description?: string;
  folderId?: string;
  articleIds: string[];
  quizIds: string[];
  estimatedMinutes?: number;
  colour?: string;
  dueDate?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  submittedAt: string;
  responses: QuizAttemptResponse[];
  passed: boolean;
}

export interface QuizAttemptResponse {
  questionId: string;
  answer: string[] | string | boolean | null;
}

export interface TrainingProgress {
  userId: string;
  completedArticles: string[];
  acknowledgedArticles: string[];
  quizAttempts: QuizAttempt[];
  lastSync: string;
}

export interface UserSummaryProgress {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  latestLogin?: string;
  completedArticles: number;
  totalArticles: number;
  completedQuizzes: number;
  averageScore?: number;
  outstandingArticles: number;
  outstandingQuizzes: number;
}

export interface AdminDashboardSnapshot {
  totalArticles: number;
  totalDrafts: number;
  totalUsers: number;
  activeTrainingModules: number;
  averageCompletion: number;
  topPerformers: UserSummaryProgress[];
  atRiskUsers: UserSummaryProgress[];
  modules: TrainingModule[];
  quizzes: ArticleQuiz[];
}
