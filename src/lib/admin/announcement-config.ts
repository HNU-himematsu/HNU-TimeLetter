import * as fs from 'fs';
import * as path from 'path';
import { getSyncPaths } from '@/lib/sync/paths';

/**
 * 活动公告弹窗配置
 *
 * 持久化至 runtime/admin/announcement-config.json，
 * 通过后台管理页面修改，前端弹窗每次打开时读取。
 *
 * featureConfig 与飞书云文档组件 SDK setFeatureConfig / 构造器 config 参数对齐：
 * https://open.feishu.cn/document/common-capabilities/web-components/uYDO3YjL2gzN24iN3cjN/feature-config
 *
 * 使用 Record<string, unknown> 以直接透传给 SDK，避免在此维护镜像 SDK 的嵌套类型。
 */

export interface AnnouncementConfig {
  docUrl: string;
  featureConfig: Record<string, unknown>;
}

export class AnnouncementConfigValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getDefaultAnnouncementConfig(): AnnouncementConfig {
  return {
    docUrl: 'https://himematsu.feishu.cn/docx/EbsDdehuLo1801xBzb1cxzJLnHb',
    featureConfig: {
      extensions: {
        suiteNavBar: {
          disable: true,
          docComponentHeader: {
            bottomLine: { disable: false },
            moreMenu: {
              enable: false,
              items: {
                findAndReplace: { enable: false },
                applyEditPermission: { enable: false },
                clone: { enable: false },
                export: { enable: false },
                detailV2: { enable: false },
                history: { enable: false },
                commentVersion: { enable: false },
                translateToLang: { enable: false },
                print: { enable: false },
                delete: { enable: false },
                docMiniApp: { enable: false },
              },
            },
            shareBtn: {
              enable: false,
              border: false,
              visibleConfig: {
                invite: false,
                shareLink: false,
                shareMethod: false,
              },
            },
            collabAvatar: { enable: false },
          },
        },
        content: {
          readonly: true,
          titleVisible: true,
          scrollbar: { enable: true },
          unscrollable: false,
          border: { enable: false },
          toolbox: { enable: false },
        },
        comment: {
          partial: { disable: true, visible: false, open: false },
          global: { disable: true },
          appUserCanComment: false,
        },
        directory: { disable: true, pin: false },
        like: { disable: true },
        footer: { enable: false },
        fullscreen: { enable: false },
      },
    },
  };
}

function getConfigFilePath(): string {
  const { adminRoot } = getSyncPaths();
  return path.join(adminRoot, 'announcement-config.json');
}

export function getAnnouncementConfig(): AnnouncementConfig {
  const configPath = getConfigFilePath();
  const defaults = getDefaultAnnouncementConfig();

  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(configPath, 'utf-8'),
    ) as Partial<AnnouncementConfig>;

    return {
      docUrl:
        typeof parsed.docUrl === 'string' && parsed.docUrl.trim()
          ? parsed.docUrl.trim()
          : defaults.docUrl,
      featureConfig: isRecord(parsed.featureConfig)
        ? parsed.featureConfig
        : defaults.featureConfig,
    };
  } catch {
    return defaults;
  }
}

export function updateAnnouncementConfig(
  patch: Partial<AnnouncementConfig>,
): AnnouncementConfig {
  const current = getAnnouncementConfig();
  const { adminRoot } = getSyncPaths();
  fs.mkdirSync(adminRoot, { recursive: true });

  const nextDocUrl =
    patch.docUrl !== undefined ? patch.docUrl.trim() : current.docUrl;
  if (!nextDocUrl) {
    throw new AnnouncementConfigValidationError('文档链接不能为空');
  }

  const nextFeatureConfig = patch.featureConfig ?? current.featureConfig;
  if (!isRecord(nextFeatureConfig)) {
    throw new AnnouncementConfigValidationError('featureConfig 必须是对象');
  }

  const next: AnnouncementConfig = {
    docUrl: nextDocUrl,
    featureConfig: nextFeatureConfig,
  };

  fs.writeFileSync(getConfigFilePath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
