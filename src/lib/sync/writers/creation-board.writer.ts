import * as path from 'node:path';
import type { CreationIdea } from '../../types';
import { validateCreationBoardData } from '../../content-schema';
import { writeJsonFile } from './json-writer';

export const CREATION_BOARD_FILE_PATH = 'src/data/creation-board.json';

const creationBoardFile = path.resolve(process.cwd(), CREATION_BOARD_FILE_PATH);

export function writeCreationBoard(ideas: CreationIdea[]) {
  const data = validateCreationBoardData({ ideas, headers: [] });
  // headers 字段由 creation_headers 模块独立管理，此处仅写 ideas
  writeJsonFile(creationBoardFile, { ideas: data.ideas });
  return CREATION_BOARD_FILE_PATH;
}
