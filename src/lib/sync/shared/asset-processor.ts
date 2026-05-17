import type { SyncContext } from '../types';
import { getAttachments } from './field-reader';

export interface ProcessAttachmentsResult {
  urls: string[];
  names: string[];
  warnings: string[];
}

export async function processAttachments(
  ctx: SyncContext,
  attachmentField: unknown,
  usage: string,
  recordId: string,
): Promise<ProcessAttachmentsResult> {
  if (!ctx.includeAssets || !ctx.services.oss.isConfigured) {
    return {
      urls: [],
      names: [],
      warnings: [],
    };
  }

  const attachments = getAttachments(attachmentField);
  if (attachments.length === 0) {
    return {
      urls: [],
      names: [],
      warnings: [],
    };
  }

  const urls: string[] = [];
  const names: string[] = [];
  const warnings: string[] = [];

  for (const attachment of attachments) {
    const fileToken = attachment.file_token || attachment.token;
    const fileName = attachment.name || 'image.jpg';
    if (!fileToken) {
      continue;
    }

    try {
      const buffer = await ctx.services.feishuDrive.downloadAttachment(fileToken);
      const uploaded = await ctx.services.oss.upload(buffer, fileName);
      urls.push(uploaded.url);
      names.push(fileName);
    } catch (error) {
      const warning = `记录 ${recordId} 的 ${usage} 附件 ${fileName} 处理失败: ${
        error instanceof Error ? error.message : String(error)
      }`;
      warnings.push(warning);
      ctx.logger.warn(warning);
    }
  }

  return { urls, names, warnings };
}
