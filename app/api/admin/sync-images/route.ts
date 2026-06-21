import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Each entry: keywords that ALL must appear in the item name (case-insensitive), and the public file
const IMAGE_RULES: { match: string[]; file: string }[] = [
  { match: ['spaghetti', 'beef'],    file: 'Spaghetti + Beef.jpg' },
  { match: ['spaghetti', 'chicken'], file: 'Spaghetti + Chicken.jpg' },
  { match: ['spaghetti', 'turkey'],  file: 'Spaghetti + turkey.jpg' },
  { match: ['indomie', 'egg'],       file: 'Indomie + Egg.jpg' },
  { match: ['noodle', 'chicken'],    file: 'Noodles and chicken.jpg' },
  { match: ['turkey', 'wing'],       file: "Smoked Turkey Wings (It's Worth Trying Something Different!).jpg" },
  { match: ['plantain'],             file: 'Fried Plantain.jpg' },
  { match: ['coke'],                 file: 'Chilled Coke.jpg' },
  { match: ['coleslaw'],             file: 'Coleslaw.jpg' },
];

function fileToUrl(filename: string): string {
  return '/' + filename; // Next.js Image component handles encoding automatically
}

function matchImage(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of IMAGE_RULES) {
    if (rule.match.every(kw => lower.includes(kw))) {
      return fileToUrl(rule.file);
    }
  }
  return null;
}

export async function POST() {
  // 1. Fetch all menu items
  const { data: items, error: fetchErr } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, image_url');

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const results: { name: string; url: string }[] = [];
  const skipped: string[] = [];

  // 2. Update image_url for each matched item
  for (const item of items ?? []) {
    const url = matchImage(item.name);
    if (!url) { skipped.push(item.name); continue; }
    const { error } = await supabaseAdmin
      .from('menu_items')
      .update({ image_url: url })
      .eq('id', item.id);
    if (!error) results.push({ name: item.name, url });
  }

  // 3. Insert Coleslaw if it doesn't already exist
  const exists = (items ?? []).some(i => i.name.toLowerCase().includes('coleslaw'));
  if (!exists) {
    const { error: insErr } = await supabaseAdmin.from('menu_items').insert({
      name: 'Coleslaw',
      desc: 'Fresh homemade coleslaw — crisp cabbage, carrots, and a creamy dressing.',
      price: 700,
      category: 'sides',
      image_url: fileToUrl('Coleslaw.jpg'),
      mins: 5,
    });
    if (!insErr) results.push({ name: 'Coleslaw (new)', url: fileToUrl('Coleslaw.jpg') });
  }

  return NextResponse.json({ updated: results, skipped });
}
