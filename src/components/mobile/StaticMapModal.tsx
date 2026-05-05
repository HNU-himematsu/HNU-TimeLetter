'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContainedMapSize } from '@/lib/hooks';
import { getPrimaryStory, getStoryAvatarUrl } from '@/lib/content';
import { useContentData } from '@/lib/content-store';

interface StaticMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * StaticMapModal: 移动端静态地图入口
 * 仅供地理参考，支持 Pin 点展示
 */
export function StaticMapModal({ isOpen, onClose }: StaticMapModalProps) {
  const data = useContentData();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapAspect, setMapAspect] = useState<number | null>(null);
  // 展示框 border-4 (4px) + box-content 绘制在 width/height 之外，预留 4px 安全内边距。
  const mapSize = useContainedMapSize(mapContainerRef, mapAspect, { insetPx: 4 });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="relative w-full max-w-lg aspect-[3/4] bg-background rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-white">
              <div>
                <h2 className="mb-0 text-lg font-serif text-stone-800 tracking-wider">校园时光地图</h2>
                <p className="text-[9px] text-stone-400 uppercase tracking-widest">Static Reference Map</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-stone-100"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative overflow-auto bg-background">
              <div className="relative min-w-[600px] h-full flex items-center justify-center p-4">
                <div className="relative w-full h-full" ref={mapContainerRef}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* 地图展示框：4px 纯白边框 + 轻微投影，与桌面端保持一致。
                        box-content：边框绘制在 width/height 之外，保持内容区
                        宽高比与 mapSize 一致，防止 Pin 百分比坐标相对底图偏移。 */}
                    <div
                      className="relative box-content border-4 border-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                      style={{ width: mapSize.width, height: mapSize.height }}
                    >
                      <Image
                        src="/images/map.svg"
                        alt="HNU Map"
                        fill
                        className="object-contain"
                        priority
                        sizes="100vw"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            setMapAspect(img.naturalWidth / img.naturalHeight);
                          }
                        }}
                      />
                      
                      {data.locations.map((loc) => {
                        const latestStory = getPrimaryStory(loc);

                        return (
                          <div
                            key={loc.id}
                            className="absolute"
                            style={{
                              left: `${loc.x}%`,
                              top: `${loc.y}%`,
                              transform: 'translate(-50%, -50%)' 
                            }}
                          >
                            {latestStory ? (
                              <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white">
                                <Image
                                  src={getStoryAvatarUrl(latestStory)}
                                  alt={latestStory.characterName}
                                  width={32}
                                  height={32}
                                  className="object-cover"
                                  sizes="32px"
                                />
                              </div>
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#cfb27f] bg-[#fff4df] text-[#8b5a2b] shadow-lg">
                                <MapPin className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white text-center border-t border-stone-100">
              <p className="text-[10px] text-stone-400 font-serif tracking-widest uppercase italic">
                &quot;在这里，寻回那些散落的时光&quot;
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
