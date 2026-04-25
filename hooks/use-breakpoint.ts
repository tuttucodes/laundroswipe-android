import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 0,
  md: 600,
  lg: 900,
  xl: 1200,
};

export function useBreakpoint(): {
  bp: Breakpoint;
  width: number;
  height: number;
  isTablet: boolean;
  isPhone: boolean;
} {
  const { width, height } = useWindowDimensions();
  let bp: Breakpoint = 'sm';
  if (width >= BREAKPOINTS.xl) bp = 'xl';
  else if (width >= BREAKPOINTS.lg) bp = 'lg';
  else if (width >= BREAKPOINTS.md) bp = 'md';
  return {
    bp,
    width,
    height,
    isTablet: bp !== 'sm',
    isPhone: bp === 'sm',
  };
}

const CONTAINER_MAX = 720;

export function containerWidthStyle(width: number): { maxWidth: number; alignSelf: 'center' } {
  return {
    maxWidth: Math.min(width, CONTAINER_MAX),
    alignSelf: 'center',
  };
}
