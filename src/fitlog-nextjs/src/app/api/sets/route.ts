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

export async function POST(req: Request) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_id: body.workout_id,
      movement_id: body.movement_id,
      weight_lbs: body.weight_lbs,
      reps: body.reps,
      rpe: body.rpe,
      notes: body.notes,
    })
    .select('*, movement:movements(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update personal record if this is a new max
  if (body.weight_lbs > 0) {
    const { data: existing } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('movement_id', body.movement_id)
      .single();

    if (!existing || body.weight_lbs > existing.max_weight) {
      await supabase.from('personal_records').upsert({
        user_id: user.id,
        movement_id: body.movement_id,
        max_weight: body.weight_lbs,
        max_reps: body.reps,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,movement_id' });
    }
  }

  return NextResponse.json(data, { status: 201 });
}
