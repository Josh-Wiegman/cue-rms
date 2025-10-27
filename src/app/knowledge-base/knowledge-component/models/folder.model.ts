export interface KnowledgeFolder {
  id: string;
  name: string;
  description?: string;
  colour?: string;
  icon?: string;
  parentId?: string;
  articleCount: number;
  unreadCount: number;
  completedCount: number;
  progressPct?: number;
  children?: KnowledgeFolder[];
}
