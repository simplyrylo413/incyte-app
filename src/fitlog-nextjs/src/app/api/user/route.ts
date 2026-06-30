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

export async function GET() {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Pull last 7 days of workouts for readiness calc
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('*, sets(*)')
    .eq('user_id', user.id)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  const { data: prs } = await supabase
    .from('personal_records')
    .select('*, movement:movements(*)')
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false })
    .limit(10);

  // Simple readiness score: inverse of training density last 3 days
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentSets = (recentWorkouts || [])
    .filter((w) => new Date(w.created_at) >= threeDaysAgo)
    .reduce((acc, w) => acc + (w.sets?.length || 0), 0);

  const readiness = Math.max(20, Math.min(100, 100 - recentSets * 2));
  const totalVolume = (recentWorkouts || []).reduce(
    (acc, w) => acc + (w.sets || []).reduce((s: number, set: any) => s + set.weight_lbs * set.reps, 0), 0
  );

  return NextResponse.json({
    readiness,
    totalVolumeLbs: Math.round(totalVolume),
    recentWorkoutCount: (recentWorkouts || []).length,
    personalRecords: prs || [],
  });
}
