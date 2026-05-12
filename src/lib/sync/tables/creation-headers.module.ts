import type { CardHeaderInfo } from '../../types';
import type { TableSyncModule } from '../types';
import { getText } from '../shared/field-reader';
import { writeCreationBoardHeaders } from '../writers/creation-board-headers.writer';

export const creationHeadersModule: TableSyncModule<'creation_headers'> = {
  key: 'creation_headers',
  label: '便签头表',
  async run(ctx) {
    if (!ctx.settings.feishuCreationHeaderTableId) {
      throw new Error('缺少 FEISHU_CREATION_HEADER_TABLE_ID，无法同步便签头表');
    }

    const records = await ctx.services.feishuBitable.listRecords(
      ctx.settings.feishuCreationHeaderTableId,
    );

    const headers: CardHeaderInfo[] = [];
    for (const record of records) {
      const cardId = getText(record.fields['CARDID']).trim();
      if (!cardId) continue;
      headers.push({
        cardId,
        location: getText(record.fields['地点']).trim(),
        character: getText(record.fields['角色']).trim(),
      });
    }

    const filePath = writeCreationBoardHeaders(headers);

    return {
      output: headers,
      filesWritten: [filePath],
      summary: {
        totalRecords: records.length,
        successRecords: headers.length,
        skippedRecords: records.length - headers.length,
        failedRecords: 0,
        filesWritten: [filePath],
      },
      warnings: [],
    };
  },
};
