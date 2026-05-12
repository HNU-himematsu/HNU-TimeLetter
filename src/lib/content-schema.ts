import type {
  CardHeaderInfo,
  Contributor,
  CreationIdea,
  LocationPoint,
  Story,
} from '@/lib/types';

export class ContentSchemaError extends Error {}

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentSchemaError(`${path} 必须是对象`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new ContentSchemaError(`${path} 必须是字符串`);
  }
}

function assertOptionalString(value: unknown, path: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new ContentSchemaError(`${path} 必须是字符串`);
  }
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContentSchemaError(`${path} 必须是有效数字`);
  }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new ContentSchemaError(`${path} 必须是数组`);
  }
}

function validateStory(value: unknown, path: string): Story {
  assertObject(value, path);
  assertString(value.id, `${path}.id`);
  assertString(value.characterId, `${path}.characterId`);
  assertString(value.characterName, `${path}.characterName`);
  assertString(value.avatarUrl, `${path}.avatarUrl`);
  assertString(value.mainImageUrl, `${path}.mainImageUrl`);
  assertString(value.content, `${path}.content`);
  assertString(value.author, `${path}.author`);
  assertString(value.locationId, `${path}.locationId`);
  assertOptionalString(value.locationName, `${path}.locationName`);

  return value as unknown as Story;
}

function validateLocation(value: unknown, path: string): LocationPoint {
  assertObject(value, path);
  assertString(value.id, `${path}.id`);
  assertString(value.name, `${path}.name`);
  assertNumber(value.x, `${path}.x`);
  assertNumber(value.y, `${path}.y`);
  assertArray(value.stories, `${path}.stories`);
  value.stories.forEach((story, index) => validateStory(story, `${path}.stories[${index}]`));

  return value as unknown as LocationPoint;
}

function validateCreationIdea(value: unknown, path: string): CreationIdea {
  assertObject(value, path);
  assertString(value.id, `${path}.id`);
  assertString(value.cardId, `${path}.cardId`);
  assertString(value.content, `${path}.content`);
  assertString(value.author, `${path}.author`);
  assertArray(value.images, `${path}.images`);
  value.images.forEach((image, index) => assertString(image, `${path}.images[${index}]`));
  assertString(value.createdAt, `${path}.createdAt`);
  assertString(value.tags, `${path}.tags`);

  return value as unknown as CreationIdea;
}

function validateCardHeaderInfo(value: unknown, path: string): CardHeaderInfo {
  assertObject(value, path);
  assertString(value.cardId, `${path}.cardId`);
  assertString(value.location, `${path}.location`);
  assertString(value.character, `${path}.character`);

  return value as unknown as CardHeaderInfo;
}

function validateContributor(value: unknown, path: string): Contributor {
  assertObject(value, path);
  assertString(value.id, `${path}.id`);
  assertString(value.name, `${path}.name`);
  assertOptionalString(value.role, `${path}.role`);
  assertOptionalString(value.message, `${path}.message`);

  return value as unknown as Contributor;
}

export type ContentData = {
  locations: LocationPoint[];
};

export type CreationBoardData = {
  ideas: CreationIdea[];
  headers: CardHeaderInfo[];
};

export type ContributorsData = {
  contributors: Contributor[];
};

export function validateContentData(value: unknown): ContentData {
  assertObject(value, 'content');
  assertArray(value.locations, 'content.locations');
  value.locations.forEach((location, index) => validateLocation(location, `content.locations[${index}]`));
  return value as ContentData;
}

export function validateCreationBoardData(value: unknown): CreationBoardData {
  assertObject(value, 'creationBoard');
  assertArray(value.ideas, 'creationBoard.ideas');
  value.ideas.forEach((idea, index) => validateCreationIdea(idea, `creationBoard.ideas[${index}]`));
  if (!Array.isArray(value.headers)) (value as Record<string, unknown>).headers = [];
  (value.headers as unknown[]).forEach((header, index) =>
    validateCardHeaderInfo(header, `creationBoard.headers[${index}]`),
  );
  return value as CreationBoardData;
}

export function validateContributorsData(value: unknown): ContributorsData {
  assertObject(value, 'contributors');
  assertArray(value.contributors, 'contributors.contributors');
  value.contributors.forEach((contributor, index) => validateContributor(contributor, `contributors.contributors[${index}]`));
  return value as ContributorsData;
}
