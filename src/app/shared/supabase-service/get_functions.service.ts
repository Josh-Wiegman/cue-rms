import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

export async function getFunctions() {
  try {
    const { data, error } = await supabase.functions.invoke(
      'db_get_functions',
      {
        body: { name: 'Functions' },
      },
    );

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching functions:', error);
    throw error;
  }
}
