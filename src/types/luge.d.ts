declare module '@waaark/luge' {
  export interface LugeSettings {
    smooth?: { disabled?: boolean | string | string[] | Record<string, string> };
    reveal?: { stagger?: number };
    scroll?: { inertia?: number };
    sticky?: { disabled?: boolean | string | string[] | Record<string, string> };
    transition?: { disabled?: boolean };
    parallax?: { disabled?: boolean | string | string[] | Record<string, string> };
    lottie?: { disabled?: boolean | string | string[] | Record<string, string> };
  }

  export interface ScrollObserver {
    add(element: HTMLElement): void;
    remove(element: HTMLElement): void;
  }

  export interface Lifecycle {
    add(eventName: string, callback: (done: () => void) => void, position?: number, cycleName?: string): void;
    remove(eventName: string, callback: (done: () => void) => void, cycleName?: string): void;
    refresh(): void;
  }

  export interface Emitter {
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
  }

  export interface LugeInstance {
    settings(opts: LugeSettings): void;
    scrollobserver: ScrollObserver;
    lifecycle: Lifecycle;
    emitter: Emitter;
    reveal: {
      add(type: 'in' | 'out', name: string, callback: (element: HTMLElement) => void): void;
    };
  }

  const luge: LugeInstance;
  export default luge;
}
