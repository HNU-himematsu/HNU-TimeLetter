import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

/* ── 服务端内存缓存，随 Node.js 进程存活 ── */
interface TokenCache {
  value: string;
  expiresAt: number; // ms timestamp
}
let tokenCache: TokenCache | null = null;
let ticketCache: TokenCache | null = null;

async function getAppAccessToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.value;
  }

  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
      cache: 'no-store',
    },
  );

  const data = (await res.json()) as {
    code: number;
    msg: string;
    app_access_token?: string;
    expire?: number;
  };

  if (data.code !== 0 || !data.app_access_token) {
    throw new Error(`获取 app_access_token 失败: ${data.msg}`);
  }

  const ttl = (data.expire ?? 7200) - 300; // 提前 5 分钟失效
  tokenCache = { value: data.app_access_token, expiresAt: now + ttl * 1000 };
  return data.app_access_token;
}

async function getJsapiTicket(appAccessToken: string): Promise<string> {
  const now = Date.now();
  if (ticketCache && ticketCache.expiresAt > now) {
    return ticketCache.value;
  }

  const res = await fetch('https://open.feishu.cn/open-apis/jssdk/ticket/get', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  const data = (await res.json()) as {
    code: number;
    msg: string;
    data?: { ticket: string; expire_in: number };
  };

  if (data.code !== 0 || !data.data?.ticket) {
    throw new Error(`获取 jsapi_ticket 失败: ${data.msg}`);
  }

  const ttl = (data.data.expire_in ?? 7200) - 300;
  ticketCache = { value: data.data.ticket, expiresAt: now + ttl * 1000 };
  return data.data.ticket;
}

/**
 * GET /api/feishu-jsapi-signature?url=<当前页面URL>
 *
 * 返回飞书网页组件 SDK 鉴权所需的签名信息。
 * signature 按飞书规范以 SHA1 生成：
 *   SHA1("jsapi_ticket=...&noncestr=...&timestamp=...&url=...")
 *
 * 所需权限（飞书开发者后台）：
 *   - 应用身份（app_access_token）：drive:drive（应用身份权限）
 *   - 文档须在飞书中向该应用开放读取权限
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, {
      status: 400,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  try {
    const appAccessToken = await getAppAccessToken();
    const ticket = await getJsapiTicket(appAccessToken);

    const nonceStr = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    const signature = crypto.createHash('sha1').update(str).digest('hex');

    return NextResponse.json({
      signature,
      appId: process.env.FEISHU_APP_ID,
      timestamp,
      nonceStr,
      url,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
