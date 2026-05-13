import ContentViewer from './ContentViewer';
import { getContentData, getContributorsData, getCreationBoardData } from '@/lib/server/content-files';

export default async function ContentPage() {
  const [contentData, creationData, contributorsData] = await Promise.all([
    getContentData(),
    getCreationBoardData(),
    getContributorsData(),
  ]);

  return (
    <ContentViewer
      locations={contentData.locations}
      creationIdeas={creationData.ideas}
      contributors={contributorsData.contributors}
    />
  );
}

