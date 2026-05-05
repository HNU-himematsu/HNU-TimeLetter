/**
 * 测试 OSS 上传功能
 */

import { config } from 'dotenv';
import * as crypto from 'crypto';
import { OssClient } from '@/lib/sync/clients/oss-client';
import type { SyncEnvironmentSettings } from '@/lib/sync/types';

config({ path: '.env.local' });

const settings: SyncEnvironmentSettings = {
  ossRegion: process.env.ALIYUN_OSS_REGION,
  ossBucket: process.env.ALIYUN_OSS_BUCKET,
  ossAccessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
  ossAccessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
};

async function main() {
  try {
    console.log('🚀 测试 OSS 上传功能\n');

    if (!settings.ossRegion || !settings.ossBucket || !settings.ossAccessKeyId || !settings.ossAccessKeySecret) {
      throw new Error('缺少 OSS 配置，请检查 .env.local');
    }

    console.log('📝 OSS 配置:');
    console.log(`  Region: ${settings.ossRegion}`);
    console.log(`  Bucket: ${settings.ossBucket}`);
    console.log('');

    const client = new OssClient(settings);

    console.log('✅ OSS 客户端初始化成功\n');

    // 创建测试文件
    const testContent = Buffer.from('Hello, HNU-TimeLetter! 测试上传功能。');
    const hash = crypto.createHash('md5').update(testContent).digest('hex');
    const fileName = `test-${hash}.txt`;

    console.log(`📤 上传测试文件: ${fileName}`);

    const result = await client.upload(testContent, fileName);
    
    console.log('✅ 上传成功！');
    console.log(`📍 URL: ${result.url}`);

    console.log('\n✨ OSS 测试完成！');

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('\n❌ 测试失败:', error.message);
      if ('code' in error) {
        console.error('错误代码:', (error as Error & { code?: string }).code);
      }
    } else {
      console.error('\n❌ 测试失败:', error);
    }
    process.exit(1);
  }
}

main();
