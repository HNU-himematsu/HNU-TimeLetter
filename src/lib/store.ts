import { create } from 'zustand';

const DEV_MAP_COORDS_KEY = 'dev:showMapCoordinates';

function readMapCoordsFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEV_MAP_COORDS_KEY) === 'true';
}

interface AppState {
  // 信封是否已打开
  isEnvelopeOpened: boolean;
  setEnvelopeOpened: (opened: boolean) => void;

  // 信纸→地图的过渡加载状态（防止过渡期间页脚露出）
  isTransitioning: boolean;
  setTransitioning: (transitioning: boolean) => void;

  // 开屏入场动画是否已播完
  // 为 false 时锁定页面纵向滚动，避免用户在丝带显影/信封飘落期间下滑
  isIntroReady: boolean;
  setIntroReady: (ready: boolean) => void;

  // 活动公告飞书文档弹窗
  isAnnouncementOpen: boolean;
  openAnnouncement: () => void;
  closeAnnouncement: () => void;

  // [开发工具] 地图坐标显示：在地图页左下角实时显示鼠标所在 SVG 百分比坐标
  showMapCoordinates: boolean;
  setShowMapCoordinates: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isEnvelopeOpened: false,
  setEnvelopeOpened: (opened) => set({ isEnvelopeOpened: opened }),

  isTransitioning: false,
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

  isIntroReady: false,
  setIntroReady: (ready) => set({ isIntroReady: ready }),

  isAnnouncementOpen: false,
  openAnnouncement: () => set({ isAnnouncementOpen: true }),
  closeAnnouncement: () => set({ isAnnouncementOpen: false }),

  showMapCoordinates: readMapCoordsFlag(),
  setShowMapCoordinates: (show) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEV_MAP_COORDS_KEY, String(show));
    }
    set({ showMapCoordinates: show });
  },
}));
