import type { Character, Story } from '../../types';
import type { LocationCoords, TableSyncModule } from '../types';
import { processAttachments } from '../shared/asset-processor';
import { getText } from '../shared/field-reader';
import { readLocationConfig } from '../writers/locations.writer';
import { readCharactersData } from '../writers/characters.writer';
import { writeContent } from '../writers/content.writer';

function resolveLocationCoords(ctx: Parameters<TableSyncModule<'stories'>['run']>[0]) {
  if (ctx.outputs.locations) {
    return ctx.outputs.locations;
  }

  const dependencyWasPlanned = ctx.effectiveTables.includes('locations');
  if (dependencyWasPlanned) {
    throw new Error('stories 依赖的 locations 未生成输出');
  }

  if (ctx.dependencyMode === 'strict') {
    throw new Error('strict 模式下同步 stories 时必须同时提供 locations 依赖');
  }

  return readLocationConfig();
}

function resolveCharactersMap(
  ctx: Parameters<TableSyncModule<'stories'>['run']>[0],
): Map<string, Character> {
  const list = ctx.outputs.characters ?? readCharactersData();
  return new Map(list.map((c) => [c.id, c]));
}

async function updateStoryMainImageOssUrl(
  ctx: Parameters<TableSyncModule<'stories'>['run']>[0],
  recordId: string,
  mainImageOssUrl: string,
) {
  if (!ctx.settings.feishuTableId || !mainImageOssUrl) {
    return;
  }

  await ctx.services.feishuBitable.updateRecord(
    ctx.settings.feishuTableId,
    recordId,
    { 大图OSS_URL: mainImageOssUrl },
  );
}

function buildLocationsFromStories(coords: LocationCoords, storiesByLocation: Map<string, Story[]>) {
  const locations = [];
  const warnings: string[] = [];
  const allLocationIds = new Set([...Object.keys(coords), ...storiesByLocation.keys()]);

  for (const locationId of allLocationIds) {
    const stories = storiesByLocation.get(locationId) || [];
    let current = coords[locationId];

    if (!current) {
      current = {
        name: stories[0]?.locationId || locationId,
        x: 50,
        y: 50,
      };
      warnings.push(
        `地点ID ${locationId} 未在 locations.json 中找到，已使用默认坐标 (50, 50)`,
      );
    }

    locations.push({
      id: locationId,
      name: current.name,
      x: current.x,
      y: current.y,
      stories,
    });
  }

  return {
    locations,
    warnings,
  };
}

export const storiesModule: TableSyncModule<'stories'> = {
  key: 'stories',
  label: '首页故事',
  dependsOn: ['locations', 'characters'],
  async run(ctx) {
    if (!ctx.settings.feishuTableId) {
      throw new Error('缺少 FEISHU_TABLE_ID，无法同步 stories');
    }

    const coords = resolveLocationCoords(ctx);
    const charactersMap = resolveCharactersMap(ctx);
    const records = await ctx.services.feishuBitable.searchRecords(
      ctx.settings.feishuTableId,
      {
        ...(ctx.settings.feishuViewId ? { view_id: ctx.settings.feishuViewId } : {}),
      },
    );

    const warnings: string[] = [];
    const storiesByLocation = new Map<string, Story[]>();
    const batchSize = 5;
    let successRecords = 0;
    let skippedRecords = 0;
    let failedRecords = 0;

    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (record): Promise<{ skipped: true } | { skipped: false; story: Story }> => {
          const fields = record.fields;
          if (!fields['角色ID'] || !fields['故事内容']) {
            return { skipped: true };
          }

          const characterId = getText(fields['角色ID']);
          const character = charactersMap.get(characterId);

          let mainImageUrl = getText(fields['大图OSS_URL']);

          if (ctx.includeAssets && ctx.services.oss.isConfigured) {
            if (!mainImageUrl && fields['大图']) {
              const result = await processAttachments(ctx, fields['大图'], '大图', record.record_id);
              warnings.push(...result.warnings);
              const newUrl = result.urls[0] || '';
              if (newUrl) {
                mainImageUrl = newUrl;
                await updateStoryMainImageOssUrl(ctx, record.record_id, mainImageUrl);
              }
            }
          } else {
            if (!mainImageUrl) mainImageUrl = getText(fields['大图URL']);
          }

          return {
            skipped: false,
            story: {
              id: record.record_id,
              characterId,
              characterName: character?.name ?? '',
              avatarUrl: character?.avatarUrl ?? '',
              mainImageUrl,
              content: getText(fields['故事内容']),
              author: getText(fields['投稿人']),
              locationId: getText(fields['地点ID']),
            },
          };
        }),
      );

      results.forEach((result, batchIndex) => {
        const record = batch[batchIndex];
        if (result.status === 'rejected') {
          failedRecords += 1;
          const warning = `故事记录 ${record.record_id} 处理失败: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`;
          warnings.push(warning);
          ctx.logger.warn(warning);
          return;
        }

        if (result.value.skipped) {
          skippedRecords += 1;
          return;
        }

        const { story } = result.value;
        if (!storiesByLocation.has(story.locationId)) {
          storiesByLocation.set(story.locationId, []);
        }
        storiesByLocation.get(story.locationId)?.push(story);
        successRecords += 1;
      });
    }

    storiesByLocation.forEach((stories) => {
      stories.sort((a, b) => a.id.localeCompare(b.id));
    });

    const { locations, warnings: locationWarnings } = buildLocationsFromStories(
      coords,
      storiesByLocation,
    );
    warnings.push(...locationWarnings);
    locationWarnings.forEach((warning) => ctx.logger.warn(warning));

    const filePath = writeContent(locations);
    const storyCount = locations.reduce((sum, location) => sum + location.stories.length, 0);

    return {
      output: locations,
      filesWritten: [filePath],
      summary: {
        totalRecords: records.length,
        successRecords,
        skippedRecords,
        failedRecords,
        filesWritten: [filePath],
        locationCount: locations.length,
        storyCount,
      },
      warnings,
    };
  },
};
