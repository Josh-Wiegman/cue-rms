export type ArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'scheduled'
  | 'published'
  | 'archived';

export interface ArticleAttachment {
  id: string;
  articleId: string;
  name: string;
  type: 'file' | 'image' | 'link';
  url: string;
  size?: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ArticleReleaseRule {
  /** Optional sequence number that defines the order the article unlocks in a playlist */
  sequenceIndex?: number;
  /** Article ids that must be completed before this one unlocks */
  requiresArticles?: string[];
  /** Quiz ids that must be passed before this article unlocks */
  requiresQuizzes?: string[];
}

export interface ArticleAudience {
  /** Org unit or team ids that can see the article */
  teams?: string[];
  /** Specific user ids */
  users?: string[];
  /** Job titles or roles */
  roles?: string[];
}

export interface ArticleChecklistItem {
  id: string;
  label: string;
  completedBy?: string[];
}

export interface Article {
  id: string;
  slug: string;
  folderId: string;
  title: string;
  heroImage?: string;
  excerpt?: string;
  body: string;
  tags?: string[];
  attachments?: ArticleAttachment[];
  status: ArticleStatus;
  releaseRule?: ArticleReleaseRule;
  audience?: ArticleAudience;
  checklist?: ArticleChecklistItem[];
  estimatedReadMins?: number;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName?: string;
  isFavourite?: boolean;
}

export interface ArticleWithRelations extends Article {
  comments: ArticleComment[];
  relatedArticles: Article[];
  quiz?: ArticleQuiz;
}

export interface ArticleComment {
  id: string;
  articleId: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  body: string;
  mentions?: string[];
  attachments?: ArticleAttachment[];
  createdAt: string;
  resolvedAt?: string;
  parentId?: string;
  replies?: ArticleComment[];
}

export interface ArticleQuiz {
  id: string;
  articleId: string;
  title: string;
  summary?: string;
  passingScore: number;
  questions: QuizQuestion[];
}

export type QuizQuestionType = 'single' | 'multi' | 'true_false' | 'short_text';

export interface QuizQuestionChoice {
  id: string;
  label: string;
  correct?: boolean;
  explanation?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  type: QuizQuestionType;
  choices?: QuizQuestionChoice[];
  maxSelections?: number;
}
