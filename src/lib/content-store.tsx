'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import contentJson from '@/data/content.json';
import contributorsJson from '@/data/contributors.json';
import {
  type ContentData,
  type ContributorsData,
  validateContentData,
  validateContributorsData,
} from '@/lib/content-schema';

const initialContentData = validateContentData(contentJson);
const initialContributorsData = validateContributorsData(contributorsJson);

type ContentStoreValue = {
  content: ContentData;
  contributors: ContributorsData;
};

const ContentStoreContext = createContext<ContentStoreValue>({
  content: initialContentData,
  contributors: initialContributorsData,
});

async function fetchJson<TValue>(
  url: string,
  validate: (value: unknown) => TValue,
  fallback: TValue,
) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return fallback;
    }

    return validate(await response.json());
  } catch {
    return fallback;
  }
}

export function ContentStoreProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ContentData>(initialContentData);
  const [contributors, setContributors] = useState<ContributorsData>(initialContributorsData);

  useEffect(() => {
    let mounted = true;

    const loadRuntimeData = async () => {
      const [nextContent, nextContributors] = await Promise.all([
        fetchJson('/api/content', validateContentData, initialContentData),
        fetchJson('/api/contributors', validateContributorsData, initialContributorsData),
      ]);

      if (!mounted) {
        return;
      }

      setContent(nextContent);
      setContributors(nextContributors);
    };

    void loadRuntimeData();
    const intervalId = window.setInterval(() => void loadRuntimeData(), 30_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const value = useMemo(
    () => ({
      content,
      contributors,
    }),
    [content, contributors],
  );

  return (
    <ContentStoreContext.Provider value={value}>
      {children}
    </ContentStoreContext.Provider>
  );
}

export function useContentData() {
  return useContext(ContentStoreContext).content;
}

export function useContributorsData() {
  return useContext(ContentStoreContext).contributors;
}
