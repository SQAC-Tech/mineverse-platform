import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/shaur/Documents/mineverse-platform/mineverse/.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUT = process.argv[2];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const { data, error } = await sb.from('questions').select('*').order('type').order('round_id').order('order_index');
if (error) throw error;
const rows = data.filter(q => q.content && q.content.language_prompts);
const index = [];
for (const q of rows) {
  const dir = path.join(OUT, `${q.type}_r${q.round_id}_o${q.order_index}_${q.id.slice(0,8)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify({
    id: q.id, type: q.type, round_id: q.round_id, order_index: q.order_index,
    language_options: q.language_options, expected_answer: q.expected_answer,
    variant_group: q.variant_group, auto_grade_strategy: q.auto_grade_strategy,
    tc: (q.hidden_test_cases||[]).length,
    content_keys: Object.keys(q.content),
  }, null, 2));
  fs.writeFileSync(path.join(dir, '_prompt.txt'), q.prompt ?? '');
  for (const [lang, text] of Object.entries(q.content.language_prompts)) {
    fs.writeFileSync(path.join(dir, `${lang}.txt`), text);
  }
  index.push({ dir: path.basename(dir), id: q.id, type: q.type, langs: Object.keys(q.content.language_prompts) });
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
console.log('wrote', rows.length, 'questions to', OUT);
