export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (_name: string, _value: string) => {},
        remove: (_name: string) => {},
      },
    }
  );
}

export async function GET(req: Request) {
  const supabase = makeSupabase();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  let query = supabase.from('movements').select('*').order('name');
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = makeSupabase();
  const body = await req.json();

  const { data, error } = await supabase
    .from('movements')
    .insert({ name: body.name, body_part: body.body_part, equipment: body.equipment || [], description: body.description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
