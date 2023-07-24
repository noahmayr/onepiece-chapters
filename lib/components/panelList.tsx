'use client';
import type { Panel } from '@prisma/client';
import { PanelComponent } from './panel';
import { useInfiniteQuery } from 'react-query';
import { useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';

function chunks<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n));
  }
  return result;
}

const fetchPanels = async (
  ids: number[],
): Promise<{ panels?: Panel[] } | undefined> => {
  if (!ids.length) {
    return undefined;
  }
  const endpoint = new URL(`/panels`, location.origin);
  endpoint.searchParams.append('ids', ids.join(','));
  const response = await fetch(endpoint);
  return (await response.json()) as { panels?: Panel[] };
};

export function PanelList({ panels }: { panels: Panel[] }) {
  const analyzed = useRef(new Map<number, Panel>());
  const idsToAnalyse: number[][] = useMemo(
    (): number[][] =>
      chunks(
        panels
          .filter(
            (panel) =>
              !panel.missing &&
              !(panel.width && panel.height && panel.blurDataUrl),
          )
          .map((panel) => panel.id),
        12,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { hasNextPage, isFetching, fetchNextPage } = useInfiniteQuery({
    queryKey: 'panels',
    queryFn: async ({
      pageParam = 0,
    }): Promise<{ next?: number } | undefined> => {
      if (pageParam === undefined || !idsToAnalyse[pageParam as number]) {
        return;
      }
      const ids: number[] | undefined = idsToAnalyse[pageParam as number];
      if (ids.every((id) => analyzed.current.has(id))) {
        return;
      }
      console.log('now fetching page ', pageParam + 1);
      const result = await fetchPanels(ids);
      flushSync(() => {
        result?.panels?.reduce((acc, panel) => {
          acc.set(panel.id, panel);
          return acc;
        }, analyzed.current);
      });
      const next = (pageParam as number) + 1;

      return {
        next: idsToAnalyse[next] ? next : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage?.next,
  });

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage().catch(console.error);
    }
  }, [fetchNextPage, hasNextPage, isFetching]);

  return panels.map((panel) => {
    const analyzedPanel = analyzed.current?.get(panel.id);
    return <PanelComponent key={panel.id} panel={analyzedPanel ?? panel} />;
  });
}
