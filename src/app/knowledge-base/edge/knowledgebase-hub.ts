/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

type HandlerContext = {
  supabase: ReturnType<typeof createClient>;
  organisationId: string;
  userId: string;
};

function createSupabaseClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client = createClient(url, key, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });
  const jwtPayload = JSON.parse(atob((req.headers.get('Authorization') ?? '').split('.')[1] ?? '{}'));
  return {
    supabase: client,
    organisationId: jwtPayload?.organisation_id,
    userId: jwtPayload?.sub,
  } as HandlerContext;
}

async function getArticles(ctx: HandlerContext) {
  const { data, error } = await ctx.supabase.from('v_kb_articles_with_meta').select('*');
  if (error) throw error;
  return data.map((row: any) => mapArticleRow(row));
}

async function getArticleDetail(ctx: HandlerContext, idOrSlug: string) {
  const { data, error } = await ctx.supabase
    .from('kb_articles')
    .select(
      `*,
      tags:kb_article_tags(tag),
      attachments:kb_article_attachments(*),
      checklist:kb_article_checklist(*),
      comments:kb_comments(*, author:profiles(full_name, avatar_url)),
      quiz:kb_quizzes(*, questions:kb_quiz_questions(*, options:kb_quiz_question_options(*))),
      related:kb_training_module_articles!left(module:kb_training_modules(title))
    `,
    )
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapArticleDetail(data);
}

async function searchArticles(ctx: HandlerContext, term: string) {
  const { data, error } = await ctx.supabase.rpc('search_kb_articles', { search_term: term });
  if (error) throw error;
  return data.map((row: any) => mapArticleRow(row));
}

async function upsertArticle(ctx: HandlerContext, article: any) {
  const { data, error } = await ctx.supabase
    .from('kb_articles')
    .upsert({
      id: article.id,
      slug: article.slug,
      folder_id: article.folderId,
      title: article.title,
      excerpt: article.excerpt,
      body: article.body,
      hero_image: article.heroImage,
      estimated_read_mins: article.estimatedReadMins,
      status: article.status,
      sequence_index: article.releaseRule?.sequenceIndex,
      release_requires_articles: article.releaseRule?.requiresArticles ?? [],
      release_requires_quizzes: article.releaseRule?.requiresQuizzes ?? [],
      created_by: ctx.userId,
      updated_by: ctx.userId,
      organisation_id: ctx.organisationId,
    })
    .select()
    .single();
  if (error) throw error;

  await ctx.supabase.from('kb_article_tags').delete().eq('article_id', data.id);
  if (article.tags?.length) {
    await ctx.supabase
      .from('kb_article_tags')
      .insert(article.tags.map((tag: string) => ({ article_id: data.id, tag })));
  }

  await ctx.supabase.from('kb_article_checklist').delete().eq('article_id', data.id);
  if (article.checklist?.length) {
    await ctx.supabase
      .from('kb_article_checklist')
      .insert(
        article.checklist.map((item: any, index: number) => ({
          id: item.id,
          article_id: data.id,
          label: item.label,
          position: index,
        })),
      );
  }

  return mapArticleRow(data);
}

async function createComment(ctx: HandlerContext, payload: any) {
  const { data, error } = await ctx.supabase
    .from('kb_comments')
    .insert({
      article_id: payload.articleId,
      body: payload.body,
      mentions: payload.mentions ?? [],
      parent_id: payload.parentId ?? null,
      author_id: ctx.userId,
    })
    .select(`*, author:profiles(full_name, avatar_url)`)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    articleId: data.article_id,
    body: data.body,
    createdAt: data.created_at,
    authorId: ctx.userId,
    authorName: data.author?.full_name,
    avatarUrl: data.author?.avatar_url,
    mentions: data.mentions,
  };
}

async function toggleFavourite(ctx: HandlerContext, articleId: string) {
  const { data } = await ctx.supabase
    .from('kb_article_favourites')
    .select('*')
    .match({ article_id: articleId, user_id: ctx.userId })
    .maybeSingle();
  if (data) {
    await ctx.supabase
      .from('kb_article_favourites')
      .delete()
      .match({ article_id: articleId, user_id: ctx.userId });
    return { isFavourite: false };
  }
  await ctx.supabase
    .from('kb_article_favourites')
    .insert({ article_id: articleId, user_id: ctx.userId });
  return { isFavourite: true };
}

async function acknowledge(ctx: HandlerContext, articleId: string) {
  const { data, error } = await ctx.supabase
    .from('kb_article_acknowledgements')
    .upsert({ article_id: articleId, user_id: ctx.userId })
    .select()
    .single();
  if (error) throw error;
  return { acknowledgedAt: data.acknowledged_at };
}

async function recordProgress(ctx: HandlerContext, articleId: string, completed: boolean) {
  const payload: any = {
    article_id: articleId,
    user_id: ctx.userId,
    completed,
    updated_at: new Date().toISOString(),
  };
  if (completed) {
    payload.completed_at = new Date().toISOString();
  }
  const { error } = await ctx.supabase.from('kb_user_article_progress').upsert(payload);
  if (error) throw error;
}

async function getFolders(ctx: HandlerContext) {
  const [{ data: folders, error: folderError }, { data: articles }, { data: completions }] = await Promise.all([
    ctx.supabase.from('kb_folders').select('*').eq('organisation_id', ctx.organisationId),
    ctx.supabase.from('kb_articles').select('id, folder_id').eq('organisation_id', ctx.organisationId),
    ctx.supabase
      .from('kb_user_article_progress')
      .select('article_id, completed')
      .eq('user_id', ctx.userId)
      .eq('completed', true),
  ]);

  if (folderError) throw folderError;
  const articleByFolder = new Map<string, string[]>();
  (articles ?? []).forEach((article: any) => {
    const list = articleByFolder.get(article.folder_id) ?? [];
    list.push(article.id);
    articleByFolder.set(article.folder_id, list);
  });

  const completedSet = new Set((completions ?? []).map((row: any) => row.article_id));

  return (folders ?? []).map((row: any) => {
    const articleIds = articleByFolder.get(row.id) ?? [];
    const completedCount = articleIds.filter((id) => completedSet.has(id)).length;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      colour: row.colour,
      icon: row.icon,
      parentId: row.parent_id,
      articleCount: articleIds.length,
      completedCount,
      unreadCount: Math.max(articleIds.length - completedCount, 0),
      progressPct: articleIds.length ? Math.round((completedCount / articleIds.length) * 100) : 0,
    };
  });
}

async function getTrainingModules(ctx: HandlerContext) {
  const { data, error } = await ctx.supabase
    .from('kb_training_modules')
    .select('*, articleIds:kb_training_module_articles(article_id), quizIds:kb_training_module_quizzes(quiz_id)')
    .eq('organisation_id', ctx.organisationId);
  if (error) throw error;
  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    colour: row.colour,
    folderId: null,
    dueDate: row.due_date,
    estimatedMinutes: row.estimated_minutes,
    articleIds: row.articleIds?.map((a: any) => a.article_id) ?? [],
    quizIds: row.quizIds?.map((q: any) => q.quiz_id) ?? [],
  }));
}

async function getQuiz(ctx: HandlerContext, quizId: string) {
  const { data, error } = await ctx.supabase
    .from('kb_quizzes')
    .select('*, questions:kb_quiz_questions(*, options:kb_quiz_question_options(*))')
    .eq('id', quizId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapQuiz(data);
}

async function submitQuiz(ctx: HandlerContext, quizId: string, responses: Record<string, unknown>) {
  const quiz = await getQuiz(ctx, quizId);
  if (!quiz) throw new Error('Quiz not found');
  const score = gradeQuiz(quiz, responses);
  const { data, error } = await ctx.supabase
    .from('kb_quiz_attempts')
    .insert({
      quiz_id: quizId,
      user_id: ctx.userId,
      score: score.percentage,
      passed: score.passed,
      responses,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    quizId,
    userId: ctx.userId,
    score: data.score,
    submittedAt: data.submitted_at,
    passed: data.passed,
    responses,
  };
}

async function trainingProgress(ctx: HandlerContext) {
  const { data: completed } = await ctx.supabase
    .from('kb_user_article_progress')
    .select('article_id')
    .eq('user_id', ctx.userId)
    .eq('completed', true);
  const { data: acknowledged } = await ctx.supabase
    .from('kb_article_acknowledgements')
    .select('article_id')
    .eq('user_id', ctx.userId);
  const { data: attempts } = await ctx.supabase
    .from('kb_quiz_attempts')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('submitted_at', { ascending: false });
  return {
    userId: ctx.userId,
    completedArticles: completed?.map((row: any) => row.article_id) ?? [],
    acknowledgedArticles: acknowledged?.map((row: any) => row.article_id) ?? [],
    quizAttempts: attempts ?? [],
    lastSync: new Date().toISOString(),
  };
}

async function adminSnapshot(ctx: HandlerContext) {
  const [articles, users, modules, quizzes] = await Promise.all([
    ctx.supabase.from('kb_articles').select('id,status'),
    ctx.supabase.from('profiles').select('id, full_name'),
    getTrainingModules(ctx),
    ctx.supabase.from('kb_quizzes').select('id,title'),
  ]);
  const { data: progress } = await ctx.supabase
    .from('kb_user_article_progress')
    .select('article_id, user_id, completed');
  const { data: attempts } = await ctx.supabase
    .from('kb_quiz_attempts')
    .select('user_id, score, passed');

  const byUser = new Map<string, any>();
  progress?.forEach((row: any) => {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { completedArticles: 0, totalArticles: articles.data?.length ?? 0, completedQuizzes: 0, scores: [] });
    }
    if (row.completed) byUser.get(row.user_id).completedArticles += 1;
  });
  attempts?.forEach((row: any) => {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { completedArticles: 0, totalArticles: articles.data?.length ?? 0, completedQuizzes: 0, scores: [] });
    }
    const entry = byUser.get(row.user_id);
    entry.completedQuizzes += row.passed ? 1 : 0;
    entry.scores.push(Number(row.score));
  });

  const performers = Array.from(byUser.entries()).map(([userId, value]) => {
    const profile = users.data?.find((u: any) => u.id === userId);
    return {
      userId,
      fullName: profile?.full_name ?? 'Unknown user',
      completedArticles: value.completedArticles,
      totalArticles: value.totalArticles,
      completedQuizzes: value.completedQuizzes,
      averageScore: value.scores.length ? value.scores.reduce((a: number, b: number) => a + b, 0) / value.scores.length : null,
      outstandingArticles: value.totalArticles - value.completedArticles,
      outstandingQuizzes: Math.max(modules.length - value.completedQuizzes, 0),
    };
  });

  const averageCompletion = performers.length
    ? performers.reduce((sum, user) => sum + user.completedArticles / (user.totalArticles || 1), 0) / performers.length * 100
    : 0;

  return {
    totalArticles: articles.data?.length ?? 0,
    totalDrafts: articles.data?.filter((row: any) => row.status !== 'published').length ?? 0,
    totalUsers: users.data?.length ?? 0,
    activeTrainingModules: modules.length,
    averageCompletion,
    topPerformers: performers.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 5),
    atRiskUsers: performers
      .filter((user) => user.outstandingArticles > 0)
      .sort((a, b) => b.outstandingArticles - a.outstandingArticles)
      .slice(0, 5),
    modules,
    quizzes: quizzes.data ?? [],
  };
}

async function releaseArticles(ctx: HandlerContext, payload: any) {
  const { error } = await ctx.supabase.from('kb_article_releases').insert(
    payload.articleIds.map((articleId: string) => ({
      article_id: articleId,
      user_ids: payload.userIds ?? [],
      team_ids: payload.teamIds ?? [],
      released_by: ctx.userId,
    })),
  );
  if (error) throw error;
}

function mapArticleRow(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    folderId: row.folder_id,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    heroImage: row.hero_image,
    estimatedReadMins: row.estimated_read_mins,
    status: row.status,
    releaseRule: {
      sequenceIndex: row.sequence_index,
      requiresArticles: row.release_requires_articles ?? [],
      requiresQuizzes: row.release_requires_quizzes ?? [],
    },
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorId: row.created_by,
    updatedBy: row.updated_by,
    isFavourite: row.is_favourite ?? false,
  };
}

function mapArticleDetail(row: any) {
  return {
    ...mapArticleRow(row),
    attachments: row.attachments?.map((a: any) => ({
      id: a.id,
      articleId: a.article_id,
      name: a.name,
      type: a.type,
      url: a.url,
      size: a.size_bytes,
      uploadedBy: a.uploaded_by,
      uploadedAt: a.uploaded_at,
    })),
    checklist: row.checklist?.map((item: any) => ({ id: item.id, label: item.label })),
    comments: row.comments?.map((c: any) => ({
      id: c.id,
      articleId: c.article_id,
      authorId: c.author_id,
      authorName: c.author?.full_name ?? 'Unknown',
      avatarUrl: c.author?.avatar_url,
      body: c.body,
      mentions: c.mentions ?? [],
      createdAt: c.created_at,
    })),
    relatedArticles: [],
    quiz: row.quiz ? mapQuiz(row.quiz) : undefined,
  };
}

function mapQuiz(row: any) {
  return {
    id: row.id,
    articleId: row.article_id,
    title: row.title,
    summary: row.summary,
    passingScore: row.passing_score,
    questions: row.questions?.map((q: any) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      maxSelections: q.max_selections,
      choices: q.options?.map((option: any) => ({
        id: option.id,
        label: option.label,
        correct: option.correct,
        explanation: option.explanation,
      })),
    })),
  };
}

function gradeQuiz(quiz: any, responses: Record<string, unknown>) {
  let total = 0;
  let achieved = 0;
  quiz.questions.forEach((question: any) => {
    total += 1;
    const response = responses[question.id];
    if (question.type === 'short_text') {
      achieved += response ? 1 : 0;
      return;
    }
    if (question.type === 'true_false') {
      const correct = question.choices?.[0]?.correct ? true : false;
      achieved += String(response) === String(correct) ? 1 : 0;
      return;
    }
    const correctIds = (question.choices ?? []).filter((c: any) => c.correct).map((c: any) => c.id);
    if (!correctIds.length) return;
    const answerIds = Array.isArray(response) ? response : [response];
    const isCorrect =
      correctIds.length === answerIds.length &&
      correctIds.every((id: string) => answerIds.includes(id));
    achieved += isCorrect ? 1 : 0;
  });
  const percentage = total ? (achieved / total) * 100 : 0;
  return { percentage, passed: percentage >= quiz.passingScore };
}

serve(async (req) => {
  try {
    const ctx = createSupabaseClient(req);
    const type = req.headers.get('x-query-type');

    switch (type) {
      case 'articles-with-meta':
        return Response.json({ articles: await getArticles(ctx) });
      case 'article-detail':
        return Response.json({ article: await getArticleDetail(ctx, req.headers.get('x-article-id') ?? '') });
      case 'search-articles': {
        const body = await req.json();
        return Response.json({ articles: await searchArticles(ctx, body.term ?? '') });
      }
      case 'upsert-article': {
        const body = await req.json();
        return Response.json({ article: await upsertArticle(ctx, body.article) });
      }
      case 'create-comment': {
        const body = await req.json();
        return Response.json({ comment: await createComment(ctx, body) });
      }
      case 'toggle-favourite':
        return Response.json(await toggleFavourite(ctx, req.headers.get('x-article-id') ?? ''));
      case 'acknowledge-article':
        return Response.json(await acknowledge(ctx, req.headers.get('x-article-id') ?? ''));
      case 'record-progress': {
        const body = await req.json();
        await recordProgress(ctx, body.articleId, body.completed);
        return Response.json({ success: true });
      }
      case 'folders':
        return Response.json({ folders: await getFolders(ctx) });
      case 'training-modules':
        return Response.json({ modules: await getTrainingModules(ctx) });
      case 'quiz-detail':
        return Response.json({ quiz: await getQuiz(ctx, req.headers.get('x-quiz-id') ?? '') });
      case 'submit-quiz': {
        const body = await req.json();
        return Response.json({ attempt: await submitQuiz(ctx, req.headers.get('x-quiz-id') ?? '', body.responses ?? {}) });
      }
      case 'training-progress':
        return Response.json({ progress: await trainingProgress(ctx) });
      case 'admin-snapshot':
        return Response.json({ snapshot: await adminSnapshot(ctx) });
      case 'release-articles': {
        const body = await req.json();
        await releaseArticles(ctx, body);
        return Response.json({ success: true });
      }
      default:
        return new Response('Unsupported knowledgebase query type', { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
