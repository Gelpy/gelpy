// @ts-check

const {loadBrand} = require('./scripts/brand.cjs');

// The Gelpy theme comes from the private @gelpy/design-system package.
// CI sets GELPY_REQUIRE_BRAND=1 wherever it can install the package, so a
// missing theme fails the build instead of deploying unbranded.
const brand = loadBrand({
  siteDir: __dirname,
  required: process.env.GELPY_REQUIRE_BRAND === '1',
});

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Gelpy Engineering',
  tagline: 'Public engineering documentation for Gelpy',

  url: 'https://docs.gelpy.app',
  baseUrl: '/',
  trailingSlash: false,

  organizationName: 'Gelpy',
  projectName: 'gelpy',

  ...(brand.enabled && {favicon: brand.favicon}),
  staticDirectories: ['static', ...(brand.enabled ? [brand.staticDir] : [])],

  // Fail the build on any broken link or anchor.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onDuplicateRoutes: 'throw',
  markdown: {
    mermaid: true,
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

  themes: ['@docusaurus/theme-mermaid'],

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
        ...(brand.enabled && {
          theme: {customCss: [brand.tokensCss, './src/css/custom.css']},
        }),
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: brand.enabled ? 'Engineering' : 'Gelpy Engineering',
        ...(brand.enabled && {logo: brand.logo}),
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
