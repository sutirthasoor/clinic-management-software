import { addCollection } from '@iconify/react';
import solar from './solar-subset.json';
import { NAV_ICONS } from './icon-names';
addCollection(solar);
export const navIcon = (key) => NAV_ICONS[key] || NAV_ICONS.default;
