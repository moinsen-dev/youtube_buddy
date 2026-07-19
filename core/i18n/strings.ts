/**
 * Minimal i18n scaffold (DESIGN.md §7: German + English from day 1).
 * A real i18n library can replace this later without touching call sites —
 * strings are already centralized and keyed.
 */

export type Locale = 'de' | 'en';

export interface Strings {
  tabs: {
    home: string;
    library: string;
    search: string;
    knowledge: string;
    more: string;
  };
  dummy: {
    subtitle: string;
    meta: (breakpoint: string, theme: string) => string;
  };
}

const de: Strings = {
  tabs: {
    home: 'Home',
    library: 'Bibliothek',
    search: 'Suche',
    knowledge: 'Wissen',
    more: 'Mehr',
  },
  dummy: {
    subtitle: 'Dieser Bereich entsteht in einer späteren Phase.',
    meta: (breakpoint: string, theme: string) => `Shell: ${breakpoint} · Theme: ${theme}`,
  },
};

const en: Strings = {
  tabs: {
    home: 'Home',
    library: 'Library',
    search: 'Search',
    knowledge: 'Knowledge',
    more: 'More',
  },
  dummy: {
    subtitle: 'This section will be built in a later phase.',
    meta: (breakpoint: string, theme: string) => `Shell: ${breakpoint} · theme: ${theme}`,
  },
};

const dictionaries: Record<Locale, Strings> = { de, en };

/** Default locale for v1 (German-first per PRD personas). */
export const defaultLocale: Locale = 'de';

export function t(locale: Locale = defaultLocale): Strings {
  return dictionaries[locale];
}
