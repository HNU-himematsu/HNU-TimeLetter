import type { CardHeaderInfo, CreationIdea } from '../../types';
import type { TableSyncModule } from '../types';
import { processAttachments } from '../shared/asset-processor';
import { formatDateTime } from '../shared/dates';
import { getAttachments, getText, getNumber } from '../shared/field-reader';
import { extractUrlsFromText, mergeTextWithUrls } from '../shared/text';
import { writeCreationBoard } from '../writers/creation-board.writer';
import { readLocalCreationBoardHeaders } from '../writers/creation-board-headers.writer';

const contentTypeFieldName =
  '请选择你要添加的内容（该表可重复提交，如需填写多项，请再次提交）';

export const creationBoardModule: TableSyncModule<'creation_board'> = {
  key: 'creation_board',
  label: '创作公示板',
  dependsOn: ['creation_headers'],
  async run(ctx) {
    if (!ctx.settings.feishuCreationTableId) {
      throw new Error('缺少 FEISHU_CREATION_TABLE_ID，无法同步创作公示板');
    }

    // 从本地文件读取头表数据（由 creation_headers 模块写入）
    const headers: CardHeaderInfo[] = readLocalCreationBoardHeaders();

    const records = await ctx.services.feishuBitable.searchRecords(
      ctx.settings.feishuCreationTableId,
      {
        ...(ctx.settings.feishuCreationViewId
          ? { view_id: ctx.settings.feishuCreationViewId }
          : {}),
      },
    );

    const warnings: string[] = [];
    const ideas: CreationIdea[] = [];
    const batchSize = 5;
    let failedRecords = 0;

    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (record) => {
          const fields = record.fields;
          const cardId = getText(fields['CardID']) || getText(fields['自动编号']) || record.record_id;
          const contentType = getText(fields[contentTypeFieldName]);
          const author = getText(fields['你的昵称']);
          const existingText = getText(fields['文本']).trim();
          const attachments = getAttachments(fields['请上传你的图片']);
          const sortOrder = getNumber(fields['自动编号']);

          let imageUrls = extractUrlsFromText(existingText);

          if (ctx.includeAssets && attachments.length > 0 && imageUrls.length < attachments.length) {
            const result = await processAttachments(
              ctx,
              fields['请上传你的图片'],
              '创作公示板参考图',
              record.record_id,
            );
            warnings.push(...result.warnings);
            imageUrls = [...new Set([...imageUrls, ...result.urls])];
          }

          const mergedText = mergeTextWithUrls(existingText, imageUrls);
          if (
            ctx.includeAssets &&
            mergedText !== existingText &&
            ctx.settings.feishuCreationTableId
          ) {
            await ctx.services.feishuBitable.updateRecord(
              ctx.settings.feishuCreationTableId,
              record.record_id,
              { 文本: mergedText },
            );
          }

          return {
            id: record.record_id,
            cardId,
            content: mergedText || existingText,
            author: author || '匿名',
            images: imageUrls,
            createdAt: formatDateTime(fields['提交时间']),
            tags: contentType,
            sortOrder,
          } satisfies CreationIdea;
        }),
      );

      results.forEach((result, batchIndex) => {
        if (result.status === 'rejected') {
          failedRecords += 1;
          const warning = `创作记录 ${batch[batchIndex].record_id} 处理失败: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`;
          warnings.push(warning);
          ctx.logger.warn(warning);
          return;
        }

        ideas.push(result.value);
      });
    }

    ideas.sort((a, b) => a.sortOrder - b.sortOrder);

    const filePath = writeCreationBoard(ideas);

    return {
      output: ideas,
      filesWritten: [filePath],
      summary: {
        totalRecords: records.length,
        successRecords: ideas.length,
        skippedRecords: 0,
        failedRecords,
        filesWritten: [filePath],
        creationIdeaCount: ideas.length,
        headerCount: headers.length,
      },
      warnings,
    };
  },
};
