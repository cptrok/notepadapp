import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmtdmubkmmuchomkbvwy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdGRtdWJrbW11Y2hvbWtidnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjI0NzUsImV4cCI6MjA5MzczODQ3NX0.4FZ9t356ZaWI52E0Mofruool2OUrTNp6kmgAOi6tkhA';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
