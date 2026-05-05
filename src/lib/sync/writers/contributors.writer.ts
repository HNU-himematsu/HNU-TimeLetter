import * as path from 'node:path';
import type { Contributor } from '../../types';
import type { SyncContext } from '../types';
import { validateContributorsData } from '../../content-schema';
import { writeJsonFile } from './json-writer';

export const CONTRIBUTORS_FILE_PATH = 'src/data/contributors.json';

const contributorsFile = path.resolve(process.cwd(), CONTRIBUTORS_FILE_PATH);

export async function writeContributors(ctx: SyncContext, contributors: Contributor[]) {
  const data = validateContributorsData({
    contributors,
  });

  writeJsonFile(contributorsFile, data);

  ctx.logger.info(`鸣谢数据已生成，共 ${contributors.length} 条数据`);
  return { path: CONTRIBUTORS_FILE_PATH };
}
