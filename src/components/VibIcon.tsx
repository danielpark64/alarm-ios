import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function VibIcon({ size = 16, color = '#7B1FA2' }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="vibrate" size={size} color={color} />;
}
