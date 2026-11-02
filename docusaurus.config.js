// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Gelpy Engineering',
  tagline: 'Public engineering documentation for Gelpy',

  url: 'https://docs.gelpy.app',
  baseUrl: '/',
  trailingSlash: false,

  organizationName: 'Gelpy',
  projectName: 'gelpy',

  // Fail the build on any broken link or anchor.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onDuplicateRoutes: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    localeConfigs: {
      en: {label: 'English', htmlLang: 'en'},
      es: {label: 'Español', htmlLang: 'es'},
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Gelpy/gelpy/edit/main/',
        },
        blog: false,
        pages: false,
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Gelpy Engineering',
        items: [
          {type: 'localeDropdown', position: 'right'},
          {
            href: 'https://github.com/Gelpy/gelpy',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'light',
        copyright: `© ${new Date().getFullYear()} Gelpy`,
      },
    }),
};

module.exports = config;
