import * as crypto from 'node:crypto';
import * as path from 'node:path';
import type {
  SyncEnvironmentSettings,
  SyncOssService,
} from '../types';

type OssRequestOptions = {
  method: 'HEAD' | 'PUT';
  objectKey: string;
  body?: Buffer;
  contentType?: string;
};

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export class OssClient implements SyncOssService {
  private readonly configured: boolean;

  constructor(private readonly settings: SyncEnvironmentSettings) {
    this.configured = Boolean(
      settings.ossRegion
      && settings.ossBucket
      && settings.ossAccessKeyId
      && settings.ossAccessKeySecret,
    );
  }

  get isConfigured() {
    return this.configured;
  }

  private getEndpointUrl(objectKey: string) {
    return `https://${this.settings.ossBucket}.${this.settings.ossRegion}.aliyuncs.com/${encodeObjectKey(objectKey)}`;
  }

  private createAuthorizationHeader({
    method,
    objectKey,
    contentType = '',
  }: OssRequestOptions, date: string) {
    const canonicalizedResource = `/${this.settings.ossBucket}/${objectKey}`;
    const stringToSign = [
      method,
      '',
      contentType,
      date,
      canonicalizedResource,
    ].join('\n');
    const signature = crypto
      .createHmac('sha1', this.settings.ossAccessKeySecret || '')
      .update(stringToSign)
      .digest('base64');

    return `OSS ${this.settings.ossAccessKeyId}:${signature}`;
  }

  private async request({ method, objectKey, body, contentType }: OssRequestOptions) {
    const date = new Date().toUTCString();
    const headers = new Headers({
      Date: date,
      Authorization: this.createAuthorizationHeader(
        { method, objectKey, body, contentType },
        date,
      ),
    });

    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    return fetch(this.getEndpointUrl(objectKey), {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  async upload(buffer: Buffer, fileName: string) {
    if (!this.isConfigured || !this.settings.ossBucket || !this.settings.ossRegion) {
      throw new Error('OSS 未配置，无法上传附件');
    }

    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const ext = path.extname(fileName) || '.jpg';
    const ossPath = `hnu-timeletter/${hash}${ext}`;

    try {
      const headResponse = await this.request({
        method: 'HEAD',
        objectKey: ossPath,
      });
      if (!headResponse.ok && headResponse.status !== 404) {
        throw new Error(`OSS HEAD ${headResponse.status} ${headResponse.statusText}`);
      }
      if (headResponse.status === 404) {
        const putResponse = await this.request({
          method: 'PUT',
          objectKey: ossPath,
          body: buffer,
          contentType: 'application/octet-stream',
        });
        if (!putResponse.ok) {
          throw new Error(`OSS PUT ${putResponse.status} ${putResponse.statusText}`);
        }
      }
    } catch (error) {
      throw error;
    }

    return {
      url: `https://${this.settings.ossBucket}.${this.settings.ossRegion}.aliyuncs.com/${ossPath}`,
      path: ossPath,
      hash,
    };
  }
}
