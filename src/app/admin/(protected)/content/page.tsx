import fs from 'fs';
import path from 'path';
import ContentViewer from './ContentViewer';
import type { LocationPoint, CreationIdea, Contributor } from '@/lib/types';

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    const filePath = path.resolve(process.cwd(), relativePath);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export default async function ContentPage() {
  const contentData = readJson<{ locations: LocationPoint[] }>('src/data/content.json', { locations: [] });
  const creationData = readJson<{ ideas: CreationIdea[] }>('src/data/creation-board.json', { ideas: [] });
  const contributorsData = readJson<{ contributors: Contributor[] }>('src/data/contributors.json', { contributors: [] });

  return (
    <ContentViewer
      locations={contentData.locations}
      creationIdeas={creationData.ideas}
      contributors={contributorsData.contributors}
    />
  );
}

