import { NextRequest, NextResponse } from 'next/server';
import { generateQueries } from '@/lib/engine/config/query-generator';

export const maxDuration = 30;

interface GenerateRequest {
  topic: string;
  count?: number;
  existingFindings?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { topic, count = 12, existingFindings } = body;

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    const queries = await generateQueries(topic.trim(), count, existingFindings);
    return NextResponse.json({ queries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query generation failed' },
      { status: 500 }
    );
  }
}
