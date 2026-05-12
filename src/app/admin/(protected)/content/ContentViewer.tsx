'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { LocationPoint, CreationIdea, Contributor } from '@/lib/types';

type Tab = 'locations' | 'creation' | 'contributors';

interface Props {
  locations: LocationPoint[];
  creationIdeas: CreationIdea[];
  contributors: Contributor[];
}

export default function ContentViewer({ locations, creationIdeas, contributors }: Props) {
  const [tab, setTab] = useState<Tab>('locations');
  const [search, setSearch] = useState('');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.id.toLowerCase().includes(q) ||
        loc.stories.some(
          (s) =>
            s.characterName.toLowerCase().includes(q) ||
            s.author.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q),
        ),
    );
  }, [locations, search]);

  const filteredCreation = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return creationIdeas;
    return creationIdeas.filter(
      (idea) =>
        idea.author.toLowerCase().includes(q) ||
        idea.content.toLowerCase().includes(q) ||
        idea.tags.toLowerCase().includes(q),
    );
  }, [creationIdeas, search]);

  const filteredContributors = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return contributors;
    return contributors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.message?.toLowerCase().includes(q),
    );
  }, [contributors, search]);

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'locations', label: '地点与故事', count: locations.length },
    { key: 'creation', label: '创作公示板', count: creationIdeas.length },
    { key: 'contributors', label: '鸣谢名单', count: contributors.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">内容数据查看</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索..."
          className="rounded border border-gray-300 px-3 py-2 text-sm w-64"
        />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'locations' && (
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            共 {filteredLocations.length} 个地点
            {search && `（搜索"${search}"）`}
          </p>
          <div className="grid gap-4">
            {filteredLocations.map((loc) => (
              <div key={loc.id} className="rounded border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <span className="font-semibold text-gray-900">{loc.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{loc.id}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    坐标 {loc.x}%,{loc.y}% | {loc.stories.length} 个故事
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {loc.stories.map((story) => (
                    <div
                      key={story.id}
                      className="rounded border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                          {story.avatarUrl && (
                            <Image
                              src={story.avatarUrl}
                              alt={story.characterName}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">
                              {story.characterName}
                            </span>
                            <span className="text-xs text-gray-400">作者：{story.author}</span>
                          </div>
                          <p
                            className={`mt-1 text-sm text-gray-700 ${
                              expandedStory === story.id ? '' : 'line-clamp-2'
                            }`}
                          >
                            {story.content}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-gray-400">{story.id}</span>
                            <button
                              onClick={() =>
                                setExpandedStory(expandedStory === story.id ? null : story.id)
                              }
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {expandedStory === story.id ? '收起' : '展开'}
                            </button>
                            {story.mainImageUrl && expandedStory === story.id && (
                              <a
                                href={story.mainImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline"
                              >
                                查看大图
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loc.stories.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-2">暂无故事</p>
                  )}
                </div>
              </div>
            ))}
            {filteredLocations.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">无匹配结果</p>
            )}
          </div>
        </div>
      )}

      {tab === 'creation' && (
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            共 {filteredCreation.length} 条记录
            {search && `（搜索"${search}"）`}
          </p>
          <div className="grid gap-3">
            {filteredCreation.map((idea) => (
              <div key={idea.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{idea.author}</span>
                    {idea.tags && (
                      <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                        {idea.tags}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{idea.createdAt}</span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{idea.content}</p>
                {idea.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {idea.images.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        图片 {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-400">ID: {idea.id} | 卡片: {idea.cardId}</div>
              </div>
            ))}
            {filteredCreation.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">无匹配结果</p>
            )}
          </div>
        </div>
      )}

      {tab === 'contributors' && (
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            共 {filteredContributors.length} 位贡献者
            {search && `（搜索"${search}"）`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredContributors.map((c) => (
              <div key={c.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="font-medium text-gray-900">{c.name}</div>
                {c.role && <div className="mt-0.5 text-xs text-gray-500">{c.role}</div>}
                {c.message && (
                  <p className="mt-2 text-sm text-gray-600">{c.message}</p>
                )}
              </div>
            ))}
            {filteredContributors.length === 0 && (
              <p className="col-span-full text-center text-sm text-gray-400 py-8">无匹配结果</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
