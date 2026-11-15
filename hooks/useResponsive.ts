import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { getCompactLayout } from '@/services/compactLayout';

export function useResponsive() {
  const [dimensions, setDimensions] = useState({ width: 375, height: 667 });
  useEffect(() => {
    const update = () => {
      const next = Dimensions.get('window');
      setDimensions({ width: Math.max(1, next.width || 375), height: Math.max(1, next.height || 667) });
    };
    update();
    const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, []);
  return getCompactLayout(dimensions.width, dimensions.height);
}
