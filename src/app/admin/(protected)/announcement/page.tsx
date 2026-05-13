'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AnnouncementConfig } from '@/lib/admin/announcement-config';

type NoticeState = { type: 'success' | 'error'; text: string } | null;

/* ────────────────────────────────────────────────────────────
   Flat form state — all SDK extensions.* fields
──────────────────────────────────────────────────────────── */
type FF = {
  /* 头部 */
  nav_disable: boolean;
  nav_color: string;
  nav_bottomLine_disable: boolean;
  nav_height: string;
  /* 协作者 */
  collabAvatar_enable: boolean;
  /* 更多菜单 */
  moreMenu_enable: boolean;
  moreMenu_findAndReplace: boolean;
  moreMenu_applyEditPermission: boolean;
  moreMenu_clone: boolean;
  moreMenu_export: boolean;
  moreMenu_detailV2: boolean;
  moreMenu_history: boolean;
  moreMenu_commentVersion: boolean;
  moreMenu_translateToLang: boolean;
  moreMenu_print: boolean;
  moreMenu_delete: boolean;
  moreMenu_docMiniApp: boolean;
  /* 分享 */
  share_enable: boolean;
  share_border: boolean;
  share_text: string;
  share_invite: boolean;
  share_shareLink: boolean;
  share_shareMethod: boolean;
  /* 内容 */
  content_mode: string;
  content_readonly: boolean;
  content_titleVisible: boolean;
  content_padding: string;
  content_maxWidth: string;
  content_hyperlinkHandler: string;
  content_background: string;
  content_scrollbar_enable: boolean;
  content_unscrollable: boolean;
  content_border_enable: boolean;
  /* 划词工具栏 */
  toolbox_enable: boolean;
  toolbox_hideComment: boolean;
  /* 评论 */
  comment_partial_disable: boolean;
  comment_partial_visible: boolean;
  comment_partial_open: boolean;
  comment_global_disable: boolean;
  comment_appUserCanComment: boolean;
  /* 图片 */
  image_viewer: string;
  /* 目录 */
  directory_disable: boolean;
  directory_pin: boolean;
  /* 点赞 */
  like_disable: boolean;
  /* 底部 */
  footer_enable: boolean;
  /* 全屏 */
  fullscreen_enable: boolean;
};

/* ── helpers ── */
type Rec = Record<string, unknown>;
const b = (o: Rec, k: string, def: boolean): boolean =>
  typeof o[k] === 'boolean' ? (o[k] as boolean) : def;
const s = (o: Rec, k: string): string =>
  typeof o[k] === 'string' ? (o[k] as string) : '';
const n = (o: Rec, k: string): string =>
  typeof o[k] === 'number' ? String(o[k] as number) : '';
const sub = (o: Rec, k: string): Rec => (o[k] != null && typeof o[k] === 'object' ? (o[k] as Rec) : {});

function toFlat(fc: Record<string, unknown>): FF {
  const ext = sub(fc, 'extensions');
  const nav = sub(ext, 'suiteNavBar');
  const hdr = sub(nav, 'docComponentHeader');
  const bl  = sub(hdr, 'bottomLine');
  const mm  = sub(hdr, 'moreMenu');
  const mi  = sub(mm,  'items');
  const sh  = sub(hdr, 'shareBtn');
  const shv = sub(sh,  'visibleConfig');
  const ca  = sub(hdr, 'collabAvatar');
  const co  = sub(ext, 'content');
  const scr = sub(co,  'scrollbar');
  const brd = sub(co,  'border');
  const tb  = sub(co,  'toolbox');
  const tbHide = Array.isArray(tb.hideItems) ? (tb.hideItems as string[]) : [];
  const cm  = sub(ext, 'comment');
  const cmp = sub(cm,  'partial');
  const cmg = sub(cm,  'global');
  const img = sub(ext, 'image');
  const dir = sub(ext, 'directory');
  const lk  = sub(ext, 'like');
  const ft  = sub(ext, 'footer');
  const fs  = sub(ext, 'fullscreen');

  return {
    nav_disable:              b(nav, 'disable', true),
    nav_color:                s(hdr, 'color'),
    nav_bottomLine_disable:   b(bl,  'disable', false),
    nav_height:               n(hdr, 'height'),
    collabAvatar_enable:      b(ca,  'enable', false),
    moreMenu_enable:          b(mm,  'enable', false),
    moreMenu_findAndReplace:  b(sub(mi, 'findAndReplace'),       'enable', false),
    moreMenu_applyEditPermission: b(sub(mi, 'applyEditPermission'), 'enable', false),
    moreMenu_clone:           b(sub(mi, 'clone'),            'enable', false),
    moreMenu_export:          b(sub(mi, 'export'),           'enable', false),
    moreMenu_detailV2:        b(sub(mi, 'detailV2'),         'enable', false),
    moreMenu_history:         b(sub(mi, 'history'),          'enable', false),
    moreMenu_commentVersion:  b(sub(mi, 'commentVersion'),   'enable', false),
    moreMenu_translateToLang: b(sub(mi, 'translateToLang'),  'enable', false),
    moreMenu_print:           b(sub(mi, 'print'),            'enable', false),
    moreMenu_delete:          b(sub(mi, 'delete'),           'enable', false),
    moreMenu_docMiniApp:      b(sub(mi, 'docMiniApp'),       'enable', false),
    share_enable:             b(sh,  'enable', false),
    share_border:             b(sh,  'border', false),
    share_text:               s(sh,  'text'),
    share_invite:             b(shv, 'invite',      false),
    share_shareLink:          b(shv, 'shareLink',   false),
    share_shareMethod:        b(shv, 'shareMethod', false),
    content_mode:             s(co,  'mode'),
    content_readonly:         b(co,  'readonly',      true),
    content_titleVisible:     b(co,  'titleVisible',  true),
    content_padding:          Array.isArray(co.padding) ? JSON.stringify(co.padding) : '',
    content_maxWidth:         n(co,  'maxWidth'),
    content_hyperlinkHandler: s(co,  'hyperlinkHandler'),
    content_background:       s(co,  'background'),
    content_scrollbar_enable: b(scr, 'enable', true),
    content_unscrollable:     b(co,  'unscrollable', false),
    content_border_enable:    b(brd, 'enable', false),
    toolbox_enable:           b(tb,  'enable', false),
    toolbox_hideComment:      tbHide.includes('Comment'),
    comment_partial_disable:  b(cmp, 'disable',  true),
    comment_partial_visible:  b(cmp, 'visible',  false),
    comment_partial_open:     b(cmp, 'open',     false),
    comment_global_disable:   b(cmg, 'disable',  true),
    comment_appUserCanComment:b(cm,  'appUserCanComment', false),
    image_viewer:             s(img, 'viewer'),
    directory_disable:        b(dir, 'disable', true),
    directory_pin:            b(dir, 'pin',     false),
    like_disable:             b(lk,  'disable', true),
    footer_enable:            b(ft,  'enable',  false),
    fullscreen_enable:        b(fs,  'enable',  false),
  };
}

function toNested(f: FF): Record<string, unknown> {
  const hideItems: string[] = f.toolbox_hideComment ? ['Comment'] : [];

  const docComponentHeader: Rec = {
    bottomLine:   { disable: f.nav_bottomLine_disable },
    moreMenu: {
      enable: f.moreMenu_enable,
      items: {
        findAndReplace:       { enable: f.moreMenu_findAndReplace },
        applyEditPermission:  { enable: f.moreMenu_applyEditPermission },
        clone:                { enable: f.moreMenu_clone },
        export:               { enable: f.moreMenu_export },
        detailV2:             { enable: f.moreMenu_detailV2 },
        history:              { enable: f.moreMenu_history },
        commentVersion:       { enable: f.moreMenu_commentVersion },
        translateToLang:      { enable: f.moreMenu_translateToLang },
        print:                { enable: f.moreMenu_print },
        delete:               { enable: f.moreMenu_delete },
        docMiniApp:           { enable: f.moreMenu_docMiniApp },
      },
    },
    shareBtn: {
      enable: f.share_enable,
      border: f.share_border,
      ...(f.share_text.trim() ? { text: f.share_text.trim() } : {}),
      visibleConfig: {
        invite:      f.share_invite,
        shareLink:   f.share_shareLink,
        shareMethod: f.share_shareMethod,
      },
    },
    collabAvatar: { enable: f.collabAvatar_enable },
  };
  if (f.nav_color.trim())  docComponentHeader.color  = f.nav_color.trim();
  if (f.nav_height.trim()) docComponentHeader.height = Number(f.nav_height);

  const content: Rec = {
    readonly:      f.content_readonly,
    titleVisible:  f.content_titleVisible,
    scrollbar:     { enable: f.content_scrollbar_enable },
    unscrollable:  f.content_unscrollable,
    border:        { enable: f.content_border_enable },
    toolbox:       { enable: f.toolbox_enable, ...(hideItems.length ? { hideItems } : {}) },
  };
  if (f.content_mode.trim())             content.mode             = f.content_mode.trim();
  if (f.content_maxWidth.trim())         content.maxWidth         = Number(f.content_maxWidth);
  if (f.content_hyperlinkHandler.trim()) content.hyperlinkHandler = f.content_hyperlinkHandler.trim();
  if (f.content_background.trim())       content.background       = f.content_background.trim();
  if (f.content_padding.trim()) {
    try { content.padding = JSON.parse(f.content_padding) as unknown; } catch { /* skip */ }
  }

  const image: Rec = {};
  if (f.image_viewer.trim()) image.viewer = f.image_viewer.trim();

  return {
    extensions: {
      suiteNavBar: { disable: f.nav_disable, docComponentHeader },
      content,
      comment: {
        partial: {
          disable: f.comment_partial_disable,
          visible: f.comment_partial_visible,
          open:    f.comment_partial_open,
        },
        global:            { disable: f.comment_global_disable },
        appUserCanComment: f.comment_appUserCanComment,
      },
      ...(Object.keys(image).length ? { image } : {}),
      directory:  { disable: f.directory_disable, pin: f.directory_pin },
      like:       { disable: f.like_disable },
      footer:     { enable:  f.footer_enable },
      fullscreen: { enable:  f.fullscreen_enable },
    },
  };
}

/* ────────────────────────────────────────────────────────────
   Sub-components
──────────────────────────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
  label,
  field,
  desc,
  trueLabel = '开',
  falseLabel = '关',
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  field: string;
  desc?: string;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <label className="flex items-start gap-4 rounded border border-gray-200 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-gray-900">
          {label}
          <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-normal ${checked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {checked ? trueLabel : falseLabel}
          </span>
        </span>
        {desc && <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>}
        <code className="block text-xs text-gray-400 mt-0.5">{field}</code>
      </span>
    </label>
  );
}

function TextRow({
  value, onChange, label, field, desc, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; label: string;
  field: string; desc?: string; placeholder?: string; type?: string;
}) {
  return (
    <div className="rounded border border-gray-200 px-4 py-2.5 text-sm">
      <div className="font-medium text-gray-900">{label}</div>
      {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      <code className="block text-xs text-gray-400 mt-0.5 mb-1.5">{field}</code>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
      />
    </div>
  );
}

function SelectRow({
  value, onChange, label, field, desc, options,
}: {
  value: string; onChange: (v: string) => void; label: string;
  field: string; desc?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="rounded border border-gray-200 px-4 py-2.5 text-sm">
      <div className="font-medium text-gray-900">{label}</div>
      {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      <code className="block text-xs text-gray-400 mt-0.5 mb-1.5">{field}</code>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-5 space-y-2">{children}</div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */
export default function AnnouncementConfigPage() {
  const [docUrl, setDocUrl] = useState('');
  const [f, setF] = useState<FF | null>(null);
  const [server, setServer] = useState<AnnouncementConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const set = <K extends keyof FF>(key: K, val: FF[K]) =>
    setF((prev) => prev && { ...prev, [key]: val });
  const toggle = (key: keyof FF) =>
    setF((prev) => prev && { ...prev, [key]: !prev[key] });

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/announcement', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载配置失败');
      const data = (await res.json()) as AnnouncementConfig;
      setServer(data);
      setDocUrl(data.docUrl);
      setF(toFlat(data.featureConfig));
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : '加载配置失败' });
    }
  };

  useEffect(() => { void fetchConfig(); }, []);

  const handleReset = () => {
    if (!server) return;
    setDocUrl(server.docUrl);
    setF(toFlat(server.featureConfig));
    setNotice(null);
  };

  const handleSave = async () => {
    if (!f) return;
    if (!docUrl.trim()) { setNotice({ type: 'error', text: '文档链接不能为空' }); return; }
    setSaving(true);
    setNotice(null);
    try {
      const body: AnnouncementConfig = { docUrl: docUrl.trim(), featureConfig: toNested(f) };
      const res = await fetch('/api/admin/announcement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as AnnouncementConfig & { message?: string };
      if (!res.ok) throw new Error(data.message ?? '保存失败');
      setServer(data);
      setDocUrl(data.docUrl);
      setF(toFlat(data.featureConfig));
      setNotice({ type: 'success', text: '配置已保存，前台弹窗下次打开时生效。' });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (!f) return <div className="p-8 text-sm text-gray-600">正在加载配置…</div>;

  return (
    <div className="space-y-5">
      {/* 标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">公告配置</h2>
          <p className="mt-1 text-sm text-gray-600">
            配置活动公告弹窗的飞书文档链接与 SDK 界面功能开关，保存后立即生效。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>恢复服务器配置</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存配置'}
          </Button>
        </div>
      </div>

      {notice && (
        <div className={`rounded border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {/* 文档链接 */}
      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800">文档链接</h3>
        <p className="mt-1 text-sm text-gray-500">
          飞书云文档 URL，格式：<code className="rounded bg-gray-100 px-1 text-xs">https://xxx.feishu.cn/docx/&lt;docId&gt;</code>
        </p>
        <input type="url" value={docUrl} onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://xxx.feishu.cn/docx/..." className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono" />
        {docUrl && (
          <a href={docUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs text-blue-600 hover:underline">
            在飞书中预览 →
          </a>
        )}
      </section>

      {/* ── 头部 ── */}
      <SectionCard title="头部 (suiteNavBar)">
        <Toggle checked={f.nav_disable} onChange={() => toggle('nav_disable')}
          label="隐藏顶部导航栏" field="extensions.suiteNavBar.disable"
          desc="隐藏飞书文档顶部整个导航栏" trueLabel="隐藏" falseLabel="显示" />
        <Toggle checked={f.nav_bottomLine_disable} onChange={() => toggle('nav_bottomLine_disable')}
          label="隐藏 header 底部分割线" field="extensions.suiteNavBar.docComponentHeader.bottomLine.disable"
          trueLabel="隐藏" falseLabel="显示" />
        <TextRow value={f.nav_color} onChange={(v) => set('nav_color', v)}
          label="导航栏背景颜色" field="extensions.suiteNavBar.docComponentHeader.color"
          desc="CSS 颜色值，留空则使用默认颜色" placeholder="#ffffff" />
        <TextRow value={f.nav_height} onChange={(v) => set('nav_height', v)}
          label="导航栏高度 (px)" field="extensions.suiteNavBar.docComponentHeader.height"
          desc="数字，留空则使用默认高度" placeholder="48" type="number" />
      </SectionCard>

      {/* ── 协作者 ── */}
      <SectionCard title="协作者 (collabAvatar)">
        <Toggle checked={f.collabAvatar_enable} onChange={() => toggle('collabAvatar_enable')}
          label="显示协作者头像" field="extensions.suiteNavBar.docComponentHeader.collabAvatar.enable"
          desc="导航栏右侧当前在线协作者头像列表" trueLabel="显示" falseLabel="隐藏" />
      </SectionCard>

      {/* ── 更多菜单 ── */}
      <SectionCard title="更多菜单 (moreMenu)">
        <Toggle checked={f.moreMenu_enable} onChange={() => toggle('moreMenu_enable')}
          label="显示「更多」菜单入口" field="extensions.suiteNavBar.docComponentHeader.moreMenu.enable"
          trueLabel="显示" falseLabel="隐藏" />
        <div className="mt-1 ml-4 space-y-2 border-l-2 border-gray-100 pl-4">
          {(
            [
              ['moreMenu_findAndReplace',      '查找替换',     'findAndReplace'],
              ['moreMenu_applyEditPermission', '申请编辑权限', 'applyEditPermission'],
              ['moreMenu_clone',               '创建副本',     'clone'],
              ['moreMenu_export',              '导出',         'export'],
              ['moreMenu_detailV2',            '文档详情',     'detailV2'],
              ['moreMenu_history',             '编辑历史',     'history'],
              ['moreMenu_commentVersion',      '评论历史',     'commentVersion'],
              ['moreMenu_translateToLang',     '翻译',         'translateToLang'],
              ['moreMenu_print',               '打印',         'print'],
              ['moreMenu_delete',              '删除',         'delete'],
              ['moreMenu_docMiniApp',          '小组件',       'docMiniApp'],
            ] as const
          ).map(([key, label, itemKey]) => (
            <Toggle key={key} checked={f[key]} onChange={() => toggle(key)}
              label={label}
              field={`extensions.suiteNavBar.docComponentHeader.moreMenu.items.${itemKey}.enable`}
              trueLabel="显示" falseLabel="隐藏" />
          ))}
        </div>
      </SectionCard>

      {/* ── 分享 ── */}
      <SectionCard title="分享 (shareBtn)">
        <Toggle checked={f.share_enable} onChange={() => toggle('share_enable')}
          label="显示分享按钮" field="extensions.suiteNavBar.docComponentHeader.shareBtn.enable"
          trueLabel="显示" falseLabel="隐藏" />
        <Toggle checked={f.share_border} onChange={() => toggle('share_border')}
          label="分享按钮显示边框" field="extensions.suiteNavBar.docComponentHeader.shareBtn.border" />
        <TextRow value={f.share_text} onChange={(v) => set('share_text', v)}
          label="分享按钮文字" field="extensions.suiteNavBar.docComponentHeader.shareBtn.text"
          desc="留空则使用默认文字" placeholder="分享" />
        <div className="rounded border border-gray-200 px-4 py-2.5 text-sm">
          <div className="font-medium text-gray-900 mb-2">分享面板内容项</div>
          <div className="space-y-2">
            <Toggle checked={f.share_invite} onChange={() => toggle('share_invite')}
              label="显示邀请" field="extensions.suiteNavBar.docComponentHeader.shareBtn.visibleConfig.invite"
              trueLabel="显示" falseLabel="隐藏" />
            <Toggle checked={f.share_shareLink} onChange={() => toggle('share_shareLink')}
              label="显示分享链接" field="extensions.suiteNavBar.docComponentHeader.shareBtn.visibleConfig.shareLink"
              trueLabel="显示" falseLabel="隐藏" />
            <Toggle checked={f.share_shareMethod} onChange={() => toggle('share_shareMethod')}
              label="显示分享方式" field="extensions.suiteNavBar.docComponentHeader.shareBtn.visibleConfig.shareMethod"
              trueLabel="显示" falseLabel="隐藏" />
          </div>
        </div>
      </SectionCard>

      {/* ── 内容 ── */}
      <SectionCard title="内容 (content)">
        <SelectRow value={f.content_mode} onChange={(v) => set('content_mode', v)}
          label="页宽模式" field="extensions.content.mode"
          desc="default = 默认宽；wide = 全宽；留空 = 不设置"
          options={[{ value: '', label: '不设置' }, { value: 'default', label: 'default（默认宽）' }, { value: 'wide', label: 'wide（全宽）' }]} />
        <Toggle checked={f.content_readonly} onChange={() => toggle('content_readonly')}
          label="只读模式" field="extensions.content.readonly"
          trueLabel="只读" falseLabel="可编辑" />
        <Toggle checked={f.content_titleVisible} onChange={() => toggle('content_titleVisible')}
          label="显示文档标题" field="extensions.content.titleVisible"
          trueLabel="显示" falseLabel="隐藏" />
        <TextRow value={f.content_maxWidth} onChange={(v) => set('content_maxWidth', v)}
          label="内容最大宽度 (px)" field="extensions.content.maxWidth"
          desc="数字，留空则不限制" placeholder="800" type="number" />
        <TextRow value={f.content_padding} onChange={(v) => set('content_padding', v)}
          label="文档内边距 [上,右,下,左]" field="extensions.content.padding"
          desc='JSON 数组，例如 [10, 0, 10, 0]；留空则不设置' placeholder="[10, 0, 10, 0]" />
        <SelectRow value={f.content_hyperlinkHandler} onChange={(v) => set('content_hyperlinkHandler', v)}
          label="链接打开方式" field="extensions.content.hyperlinkHandler"
          desc="inner = 文档内打开；outer = 宿主打开；留空 = 不设置"
          options={[{ value: '', label: '不设置' }, { value: 'inner', label: 'inner（文档内）' }, { value: 'outer', label: 'outer（宿主打开）' }]} />
        <TextRow value={f.content_background} onChange={(v) => set('content_background', v)}
          label="内容区背景颜色" field="extensions.content.background"
          desc="CSS 颜色值，留空则使用默认" placeholder="#ffffff" />
        <Toggle checked={f.content_scrollbar_enable} onChange={() => toggle('content_scrollbar_enable')}
          label="显示滚动条" field="extensions.content.scrollbar.enable"
          trueLabel="显示" falseLabel="隐藏" />
        <Toggle checked={f.content_unscrollable} onChange={() => toggle('content_unscrollable')}
          label="禁止组件内滚动" field="extensions.content.unscrollable"
          trueLabel="禁止滚动" falseLabel="允许滚动" />
        <Toggle checked={f.content_border_enable} onChange={() => toggle('content_border_enable')}
          label="内容区圆角边框" field="extensions.content.border.enable"
          trueLabel="启用" falseLabel="禁用" />
      </SectionCard>

      {/* ── 划词工具栏 ── */}
      <SectionCard title="划词工具栏 (toolbox)">
        <Toggle checked={f.toolbox_enable} onChange={() => toggle('toolbox_enable')}
          label="显示划词工具栏" field="extensions.content.toolbox.enable"
          desc="文字选中时浮现的评论/高亮工具栏" trueLabel="显示" falseLabel="隐藏" />
        <Toggle checked={f.toolbox_hideComment} onChange={() => toggle('toolbox_hideComment')}
          label="隐藏划词工具栏中的「评论」按钮" field='extensions.content.toolbox.hideItems: ["Comment"]'
          trueLabel="隐藏评论" falseLabel="显示评论" />
      </SectionCard>

      {/* ── 评论 ── */}
      <SectionCard title="评论 (comment)">
        <Toggle checked={f.comment_partial_disable} onChange={() => toggle('comment_partial_disable')}
          label="隐藏局部评论" field="extensions.comment.partial.disable"
          trueLabel="隐藏" falseLabel="显示" />
        <Toggle checked={f.comment_partial_visible} onChange={() => toggle('comment_partial_visible')}
          label="局部评论可见（false 时隐藏 UI 但仍加载模块）" field="extensions.comment.partial.visible"
          trueLabel="可见" falseLabel="不可见" />
        <Toggle checked={f.comment_partial_open} onChange={() => toggle('comment_partial_open')}
          label="初始展开局部评论侧栏" field="extensions.comment.partial.open"
          desc="仅在初始化时有效" trueLabel="展开" falseLabel="折叠" />
        <Toggle checked={f.comment_global_disable} onChange={() => toggle('comment_global_disable')}
          label="隐藏全文评论" field="extensions.comment.global.disable"
          trueLabel="隐藏" falseLabel="显示" />
        <Toggle checked={f.comment_appUserCanComment} onChange={() => toggle('comment_appUserCanComment')}
          label="应用身份可评论" field="extensions.comment.appUserCanComment"
          trueLabel="可评论" falseLabel="不可评论" />
      </SectionCard>

      {/* ── 图片 ── */}
      <SectionCard title="图片 (image)">
        <SelectRow value={f.image_viewer} onChange={(v) => set('image_viewer', v)}
          label="图片预览方式" field="extensions.image.viewer"
          desc="inner = 文档内打开；outer = 宿主打开；留空 = 不设置"
          options={[{ value: '', label: '不设置' }, { value: 'inner', label: 'inner（文档内）' }, { value: 'outer', label: 'outer（宿主打开）' }]} />
      </SectionCard>

      {/* ── 目录 ── */}
      <SectionCard title="目录 (directory)">
        <Toggle checked={f.directory_disable} onChange={() => toggle('directory_disable')}
          label="隐藏目录侧栏" field="extensions.directory.disable"
          desc="文档左侧大纲/目录面板" trueLabel="隐藏" falseLabel="显示" />
        <Toggle checked={f.directory_pin} onChange={() => toggle('directory_pin')}
          label="初始收起目录" field="extensions.directory.pin"
          desc="仅在初始化时有效" trueLabel="收起" falseLabel="展开" />
      </SectionCard>

      {/* ── 点赞 / 底部 / 全屏 ── */}
      <SectionCard title="点赞 / 底部 / 全屏">
        <Toggle checked={f.like_disable} onChange={() => toggle('like_disable')}
          label="隐藏点赞区域" field="extensions.like.disable"
          trueLabel="隐藏" falseLabel="显示" />
        <Toggle checked={f.footer_enable} onChange={() => toggle('footer_enable')}
          label="显示底部" field="extensions.footer.enable"
          trueLabel="显示" falseLabel="隐藏" />
        <Toggle checked={f.fullscreen_enable} onChange={() => toggle('fullscreen_enable')}
          label="显示全屏按钮" field="extensions.fullscreen.enable"
          desc="右下角全屏切换按钮" trueLabel="显示" falseLabel="隐藏" />
      </SectionCard>

      {/* JSON 预览 */}
      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800">配置预览（JSON）</h3>
        <p className="mt-1 text-sm text-gray-500">
          将写入 <code className="rounded bg-gray-100 px-1 text-xs">runtime/admin/announcement-config.json</code>
        </p>
        <pre className="mt-3 overflow-auto rounded bg-gray-50 p-4 text-xs text-gray-700 max-h-96">
          {JSON.stringify({ docUrl: docUrl.trim(), featureConfig: toNested(f) }, null, 2)}
        </pre>
      </section>
    </div>
  );
}
