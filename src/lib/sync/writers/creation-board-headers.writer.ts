import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CardHeaderInfo } from '../../types';
import { writeJsonFile } from './json-writer';

export const CREATION_BOARD_HEADERS_FILE_PATH = 'src/data/creation-board-headers.json';

const headersFile = path.resolve(process.cwd(), CREATION_BOARD_HEADERS_FILE_PATH);

export function writeCreationBoardHeaders(headers: CardHeaderInfo[]) {
  writeJsonFile(headersFile, { headers });
  return CREATION_BOARD_HEADERS_FILE_PATH;
}

/** 从磁盘读取已同步的头表数据，文件不存在时返回空数组 */
export function readLocalCreationBoardHeaders(): CardHeaderInfo[] {
  try {
    const raw = fs.readFileSync(headersFile, 'utf-8');
    const parsed = JSON.parse(raw) as { headers?: unknown };
    if (!Array.isArray(parsed.headers)) return [];
    return parsed.headers.filter(
      (h): h is CardHeaderInfo =>
        !!h && typeof (h as CardHeaderInfo).cardId === 'string',
    );
  } catch {
    return [];
  }
}
