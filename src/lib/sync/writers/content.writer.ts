import * as path from 'node:path';
import type { LocationPoint } from '../../types';
import { validateContentData } from '../../content-schema';
import { writeJsonFile } from './json-writer';

export const CONTENT_FILE_PATH = 'src/data/content.json';

const contentFile = path.resolve(process.cwd(), CONTENT_FILE_PATH);

export function writeContent(locations: LocationPoint[]) {
  const data = validateContentData({ locations });
  writeJsonFile(contentFile, data);
  return CONTENT_FILE_PATH;
}
