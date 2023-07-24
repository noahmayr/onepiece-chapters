import db from '@/lib/db';
import { analyzePanels } from '@/lib/tcb';
import { NextResponse, type NextRequest } from 'next/server';
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids: number[] | undefined = searchParams
    .get('ids')
    ?.split(',')
    .map((id) => {
      return parseInt(id);
    });
  if (!ids) {
    return NextResponse.json({ error: 'nothing to analyze' });
  }

  const panels = await db.panel.findMany({
    where: {
      id: { in: ids },
    },
    orderBy: {
      sort: 'asc',
    },
  });
  const result = await analyzePanels(panels);
  return NextResponse.json({ panels: result });
}
