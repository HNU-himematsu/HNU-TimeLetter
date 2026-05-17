import type { Character } from '../../types';
import type { TableSyncModule } from '../types';
import { processAttachments } from '../shared/asset-processor';
import { getText } from '../shared/field-reader';
import { readCharactersData, writeCharactersData } from '../writers/characters.writer';

async function updateCharacterAvatarOssUrl(
  ctx: Parameters<TableSyncModule<'characters'>['run']>[0],
  recordId: string,
  avatarOssUrl: string,
) {
  if (!ctx.settings.feishuCharactersTableId || !avatarOssUrl) {
    return;
  }

  await ctx.services.feishuBitable.updateRecord(
    ctx.settings.feishuCharactersTableId,
    recordId,
    { 头像OSS_URL: avatarOssUrl },
  );
}

export const charactersModule: TableSyncModule<'characters'> = {
  key: 'characters',
  label: '角色',
  async run(ctx) {
    const fallback = readCharactersData();
    const warnings: string[] = [];

    if (!ctx.settings.feishuAppToken || !ctx.settings.feishuCharactersTableId) {
      const warning = '缺少飞书角色表配置，已保留本地 characters.json';
      warnings.push(warning);
      ctx.logger.warn(warning);

      return {
        output: fallback,
        summary: {
          totalRecords: 0,
          successRecords: fallback.length,
          skippedRecords: 0,
          failedRecords: 0,
          characterCount: fallback.length,
        },
        warnings,
      };
    }

    const records = await ctx.services.feishuBitable.searchRecords(
      ctx.settings.feishuCharactersTableId,
      {
        ...(ctx.settings.feishuCharactersViewId
          ? { view_id: ctx.settings.feishuCharactersViewId }
          : {}),
      },
    );

    const characters: Character[] = [];
    let successRecords = 0;
    let skippedRecords = 0;
    let failedRecords = 0;

    const batchSize = 5;

    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map(
          async (
            record,
          ): Promise<{ skipped: true } | { skipped: false; character: Character }> => {
            const fields = record.fields;
            const id = getText(fields['角色ID']);

            if (!id) {
              return { skipped: true };
            }

            let avatarUrl = getText(fields['头像OSS_URL']);

            if (ctx.includeAssets && ctx.services.oss.isConfigured) {
              if (!avatarUrl && fields['角色头像']) {
                const result = await processAttachments(
                  ctx,
                  fields['角色头像'],
                  '角色头像',
                  record.record_id,
                );
                warnings.push(...result.warnings);
                const newUrl = result.urls[0] || '';
                if (newUrl) {
                  avatarUrl = newUrl;
                  await updateCharacterAvatarOssUrl(ctx, record.record_id, avatarUrl);
                }
              }
            }

            return {
              skipped: false,
              character: {
                id,
                name: getText(fields['角色名称']),
                avatarUrl,
              },
            };
          },
        ),
      );

      results.forEach((result, batchIndex) => {
        const record = batch[batchIndex];
        if (result.status === 'rejected') {
          failedRecords += 1;
          const warning = `角色记录 ${record.record_id} 处理失败: ${
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

        characters.push(result.value.character);
        successRecords += 1;
      });
    }

    if (characters.length === 0) {
      const warning = '飞书未返回任何有效角色记录，已保留本地 characters.json';
      warnings.push(warning);
      ctx.logger.warn(warning);

      return {
        output: fallback,
        summary: {
          totalRecords: records.length,
          successRecords: 0,
          skippedRecords: records.length,
          failedRecords: 0,
          characterCount: fallback.length,
        },
        warnings,
      };
    }

    const filePath = writeCharactersData(characters);

    return {
      output: characters,
      filesWritten: [filePath],
      summary: {
        totalRecords: records.length,
        successRecords,
        skippedRecords,
        failedRecords,
        filesWritten: [filePath],
        characterCount: characters.length,
      },
      warnings,
    };
  },
};
