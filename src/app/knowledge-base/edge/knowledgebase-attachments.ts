// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const STORAGE_BUCKET = 'knowledgebase';

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const formData = await req.formData();
    const articleId = formData.get('articleId') as string;
    const file = formData.get('file') as File;

    if (!articleId || !file) {
      return new Response('Missing payload', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      },
    );
    const jwtPayload = JSON.parse(atob((req.headers.get('Authorization') ?? '').split('.')[1] ?? '{}'));
    const userId = jwtPayload?.sub;

    const filePath = `${articleId}/${crypto.randomUUID()}-${file.name}`;
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file.stream(), {
      contentType: file.type,
      upsert: false,
    });
    if (storageError) throw storageError;

    const { data, error } = await supabase
      .from('kb_article_attachments')
      .insert({
        article_id: articleId,
        name: file.name,
        url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        size_bytes: file.size,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({
      attachment: {
        id: data.id,
        articleId: data.article_id,
        name: data.name,
        url: data.url,
        type: data.type,
        size: data.size_bytes,
        uploadedAt: data.uploaded_at,
        uploadedBy: data.uploaded_by,
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message ?? 'Upload failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
