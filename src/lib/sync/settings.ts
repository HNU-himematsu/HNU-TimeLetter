import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { SyncEnvironmentSettings } from './types';

const DEFAULT_FEISHU_LOCATIONS_TABLE_ID = 'tblaMWD1PV9lwXDr';
const DEFAULT_FEISHU_OSS_TABLE_ID = 'tblwLUNdWNzv1kZw';
const DEFAULT_FEISHU_CREATION_TABLE_ID = 'tblKNYCf641UMSUe';
const DEFAULT_FEISHU_CREATION_VIEW_ID = 'vewbLA6eBY';
const DEFAULT_FEISHU_CREATION_HEADER_TABLE_ID = 'tblGfb0GabFjHWB8';

let envLoaded = false;

export function loadSyncEnv(workspaceRoot = process.cwd()) {
  if (envLoaded) {
    return;
  }

  const envPath = path.join(workspaceRoot, '.env.local');
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }

  envLoaded = true;
}

export function getSyncEnvironmentSettings(): SyncEnvironmentSettings {
  loadSyncEnv();

  return {
    feishuAppId: process.env.FEISHU_APP_ID,
    feishuAppSecret: process.env.FEISHU_APP_SECRET,
    feishuAppToken: process.env.FEISHU_APP_TOKEN,
    feishuTableId: process.env.FEISHU_TABLE_ID,
    feishuViewId: process.env.FEISHU_VIEW_ID,
    feishuCreationTableId:
      process.env.FEISHU_CREATION_TABLE_ID || DEFAULT_FEISHU_CREATION_TABLE_ID,
    feishuCreationViewId:
      process.env.FEISHU_CREATION_VIEW_ID || DEFAULT_FEISHU_CREATION_VIEW_ID,
    feishuCreationHeaderTableId:
      process.env.FEISHU_CREATION_HEADER_TABLE_ID || DEFAULT_FEISHU_CREATION_HEADER_TABLE_ID,
    feishuOssTableId: process.env.FEISHU_OSS_TABLE_ID || DEFAULT_FEISHU_OSS_TABLE_ID,
    feishuLocationsTableId:
      process.env.FEISHU_LOCATIONS_TABLE_ID || DEFAULT_FEISHU_LOCATIONS_TABLE_ID,
    feishuContributorsTableId:
      process.env.FEISHU_CONTRIBUTORS_TABLE_ID || 'tbl1aSvNwBjlVJzd',
    ossRegion: process.env.ALIYUN_OSS_REGION,
    ossBucket: process.env.ALIYUN_OSS_BUCKET,
    ossAccessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
    ossAccessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  };
}
