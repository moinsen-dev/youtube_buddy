import { t } from '@/core/i18n/strings';

/**
 * The five main navigation areas (DESIGN.md §3).
 * Route names are English (code convention); labels come from core/i18n.
 */
export interface NavItem {
  key: 'home' | 'library' | 'search' | 'knowledge' | 'more';
  route: string;
  /** Ionicons name; filled variant used for the active tab. */
  icon: string;
  iconActive: string;
}

export const navItems: NavItem[] = [
  { key: 'home', route: '/', icon: 'home-outline', iconActive: 'home' },
  { key: 'library', route: '/library', icon: 'library-outline', iconActive: 'library' },
  { key: 'search', route: '/search', icon: 'search-outline', iconActive: 'search' },
  { key: 'knowledge', route: '/knowledge', icon: 'book-outline', iconActive: 'book' },
  {
    key: 'more',
    route: '/more',
    icon: 'ellipsis-horizontal-outline',
    iconActive: 'ellipsis-horizontal',
  },
];

export function navLabel(key: NavItem['key']): string {
  return t().tabs[key];
}
