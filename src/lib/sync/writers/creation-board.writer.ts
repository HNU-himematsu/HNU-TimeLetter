import * as path from 'node:path';
import type { CreationIdea } from '../../types';
import { validateCreationBoardData } from '../../content-schema';
import { writeJsonFile } from './json-writer';

export const CREATION_BOARD_FILE_PATH = 'src/data/creation-board.json';

const creationBoardFile = path.resolve(process.cwd(), CREATION_BOARD_FILE_PATH);

export function writeCreationBoard(ideas: CreationIdea[]) {
  const data = validateCreationBoardData({ ideas });
  writeJsonFile(creationBoardFile, data);
  return CREATION_BOARD_FILE_PATH;
}
