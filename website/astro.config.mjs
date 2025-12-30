import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import mermaid from 'astro-mermaid'
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc'

export default defineConfig({
  site: 'https://ash-r1.github.io',
  base: '/type-git',
  integrations: [
    mermaid(), // Must come before starlight
    starlight({
      title: 'type-git',
      description:
        'Type-safe Git wrapper library with LFS support for Node.js/Deno/Bun',

      social: {
        github: 'https://github.com/ash-r1/type-git',
      },

      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ja: {
          label: '日本語',
          lang: 'ja',
        },
      },

      sidebar: [
        {
          label: 'Getting Started',
          translations: { ja: 'はじめに' },
          items: [
            {
              label: 'Introduction',
              link: '/',
              translations: { ja: 'イントロダクション' },
            },
            {
              label: 'Quick Start',
              link: '/getting-started/',
              translations: { ja: 'クイックスタート' },
            },
            {
              label: 'Core Concepts',
              link: '/core-concepts/',
              translations: { ja: 'コアコンセプト' },
            },
          ],
        },
        {
          label: 'Guides',
          translations: { ja: 'ガイド' },
          autogenerate: { directory: 'guides' },
        },
        typeDocSidebarGroup,
      ],

      editLink: {
        baseUrl: 'https://github.com/ash-r1/type-git/edit/main/website/',
      },

      plugins: [
        starlightTypeDoc({
          entryPoints: ['../src/index.ts'],
          tsconfig: '../tsconfig.json',
          output: 'api',
          sidebar: {
            label: 'API Reference',
            collapsed: false,
          },
          typeDoc: {
            excludePrivate: true,
            excludeProtected: true,
            excludeInternal: true,
            skipErrorChecking: true,
            readme: 'none',
          },
        }),
      ],

      customCss: ['./src/styles/custom.css'],
    }),
  ],
})
