import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Character } from '../../types';
import { writeJsonFile } from './json-writer';

export const CHARACTERS_FILE_PATH = 'src/data/characters.json';

const charactersFile = path.resolve(process.cwd(), CHARACTERS_FILE_PATH);

export function readCharactersData(): Character[] {
  try {
    if (!fs.existsSync(charactersFile)) {
      return [];
    }
    const raw = fs.readFileSync(charactersFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Character[];
    }
    return [];
  } catch {
    return [];
  }
}

export function writeCharactersData(characters: Character[]) {
  writeJsonFile(charactersFile, characters);
  return CHARACTERS_FILE_PATH;
}
