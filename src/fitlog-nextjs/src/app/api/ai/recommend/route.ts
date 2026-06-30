export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { movementId, movementName, lastWeight, lastReps, lastRPE, history } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { weight: lastWeight, reps: lastReps, reasoning: 'AI unavailable — configure ANTHROPIC_API_KEY.' },
      { status: 200 }
    );
  }

  const historyText = (history || []).slice(-5).map((s: any) =>
    `${s.weight_lbs}lbs × ${s.reps} reps @ RPE ${s.rpe}`
  ).join('\n');

  const prompt = `You are a strength training coach. A lifter just completed a set.

Movement: ${movementName || movementId}
Last set: ${lastWeight}lbs × ${lastReps} reps @ RPE ${lastRPE}
Recent history:
${historyText || 'No history available.'}

Provide a progressive overload recommendation for the NEXT set. Apply these principles:
- If RPE < 7: increase weight or reps
- If RPE 7-8: maintain or small increase
- If RPE 9-10: maintain or slight decrease
- Weight increments: 2.5lb, 5lb, or 10lb only
- Keep reps in 1-15 range

Respond with JSON only, no markdown:
{"weight": number, "reps": number, "reasoning": "one sentence explanation"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    let rec;
    try {
      rec = JSON.parse(text);
    } catch {
      // Try to extract JSON from the text
      const match = text.match(/\{[^}]+\}/);
      rec = match ? JSON.parse(match[0]) : null;
    }

    if (!rec) {
      return NextResponse.json({ weight: lastWeight, reps: lastReps, reasoning: 'Maintain current load.' });
    }

    return NextResponse.json({
      weight: rec.weight,
      reps: rec.reps,
      reasoning: rec.reasoning,
    });
  } catch (err) {
    return NextResponse.json(
      { weight: lastWeight, reps: lastReps, reasoning: 'Unable to generate recommendation.' },
      { status: 200 }
    );
  }
}
