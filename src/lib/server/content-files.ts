import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import contentJson from '@/data/content.json';
import creationBoardJson from '@/data/creation-board.json';
import creationBoardHeadersJson from '@/data/creation-board-headers.json';
import contributorsJson from '@/data/contributors.json';
import {
  type ContentData,
  type ContributorsData,
  type CreationBoardData,
  validateContentData,
  validateContributorsData,
  validateCreationBoardData,
} from '@/lib/content-schema';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

async function readDataFile<TValue>(
  fileName: string,
  fallback: unknown,
  validate: (value: unknown) => TValue,
) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), 'utf-8');
    return validate(JSON.parse(raw));
  } catch {
    return validate(fallback);
  }
}

export function getContentData(): Promise<ContentData> {
  return readDataFile('content.json', contentJson, validateContentData);
}

export async function getCreationBoardData(): Promise<CreationBoardData> {
  // 主表（ideas）与头表（headers）分文件存储，读取时合并
  const [ideasRaw, headersRaw] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, 'creation-board.json'), 'utf-8').catch(() => null),
    fs.readFile(path.join(DATA_DIR, 'creation-board-headers.json'), 'utf-8').catch(() => null),
  ]);

  const ideas = ideasRaw ? (JSON.parse(ideasRaw) as { ideas?: unknown }).ideas : (creationBoardJson as { ideas?: unknown }).ideas;
  const headers = headersRaw
    ? (JSON.parse(headersRaw) as { headers?: unknown }).headers
    : (creationBoardHeadersJson as { headers?: unknown }).headers;

  return validateCreationBoardData({ ideas: ideas ?? [], headers: headers ?? [] });
}

export function getContributorsData(): Promise<ContributorsData> {
  return readDataFile('contributors.json', contributorsJson, validateContributorsData);
}
