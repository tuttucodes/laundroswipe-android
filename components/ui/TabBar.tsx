import React, { useEffect, useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { ScaleButton } from './ScaleButton';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState({ height: 20, width: 100 });
  
  // Filter out screen routes that shouldn't appear in the tab bar
  const visibleRoutes = state.routes.filter(
    (route) => descriptors[route.key].options.href !== null
  );

  const buttonWidth = dimensions.width / Math.max(visibleRoutes.length, 1);
  
  // Map the actual focused route to its index within the VISIBLE routes
  const focusedRouteKey = state.routes[state.index].key;
  const visibleIndex = visibleRoutes.findIndex((r) => r.key === focusedRouteKey);
  const safeVisibleIndex = visibleIndex >= 0 ? visibleIndex : 0;

  const tabPositionX = useSharedValue(0);

  useEffect(() => {
    tabPositionX.value = withSpring(safeVisibleIndex * buttonWidth, { 
      damping: 20, stiffness: 240, mass: 0.8 
    });
  }, [safeVisibleIndex, buttonWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabPositionX.value }],
    width: buttonWidth,
  }));

  const onTabbarLayout = (e: LayoutChangeEvent) => {
    setDimensions({ 
      height: e.nativeEvent.layout.height, 
      width: e.nativeEvent.layout.width 
    });
  };

  return (
    <View style={{
      position: 'absolute',
      bottom: Math.max(insets.bottom, 16),
      left: 32,
      right: 32,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 0,
      shadowColor: '#1746A2',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.15,
      shadowRadius: 32,
      elevation: 8,
    }} onLayout={onTabbarLayout}>
      
      {/* Indicator Pill */}
      {dimensions.width > 100 && (
        <Animated.View style={[{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0,
        }, animatedIndicatorStyle]}>
          <View style={{
            backgroundColor: '#1E1E1E', // Pitch black modern selection pill
            width: '75%',
            height: '100%',
            borderRadius: 999,
          }} />
        </Animated.View>
      )}

      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const isFocused = route.key === focusedRouteKey;
        const iconColor = isFocused ? '#FFFFFF' : '#94A3B8';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <ScaleButton
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            hapticMode="selection"
            scaleTo={0.88}
            style={{ 
              flex: 1, 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            {options.tabBarIcon?.({ 
              focused: isFocused, 
              color: iconColor, 
              size: 22 
            }) ?? null}
          </ScaleButton>
        );
      })}
    </View>
  );
}
