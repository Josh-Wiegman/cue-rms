export interface Article {
  id: string;
  title: string;
  excerpt?: string;
  body: string;
  tags?: string[];
  updated_at?: string; // ISO date
}
