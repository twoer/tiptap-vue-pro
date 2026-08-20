import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const packageMatrix = [
  {
    name: 'tiptap-vue-pro-core',
    directory: 'packages/core',
    componentExport: null,
    requiredFiles: [
      'package/dist/index.js',
      'package/dist/index.umd.cjs',
      'package/dist/index.d.ts',
      'package/README.md',
      'package/LICENSE',
      'package/THIRD_PARTY_NOTICES.md',
    ],
  },
  {
    name: 'tiptap-vue-pro-element-plus',
    directory: 'packages/element-plus',
    componentExport: 'ProEditorElementPlus',
    requiredFiles: [
      'package/dist/index.js',
      'package/dist/index.umd.cjs',
      'package/dist/index.d.ts',
      'package/dist/style.css',
      'package/README.md',
      'package/LICENSE',
    ],
  },
  {
    name: 'tiptap-vue-pro-naive',
    directory: 'packages/naive',
    componentExport: 'ProEditorNaive',
    requiredFiles: [
      'package/dist/index.js',
      'package/dist/index.umd.cjs',
      'package/dist/index.d.ts',
      'package/dist/style.css',
      'package/README.md',
      'package/LICENSE',
    ],
  },
  {
    name: 'tiptap-vue-pro-ant-design-vue',
    directory: 'packages/ant-design-vue',
    componentExport: 'ProEditorAntDesignVue',
    requiredFiles: [
      'package/dist/index.js',
      'package/dist/index.umd.cjs',
      'package/dist/index.d.ts',
      'package/dist/style.css',
      'package/README.md',
      'package/LICENSE',
    ],
  },
]

const rootExport = {
  types: './dist/index.d.ts',
  import: './dist/index.js',
  require: './dist/index.umd.cjs',
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function run(command, args, cwd = repositoryRoot) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const stderr = String(error.stderr ?? '').trim()
    const stdout = String(error.stdout ?? '').trim()
    const rawDetails = [stderr, stdout].filter(Boolean).join('\n')
    const details = rawDetails.length > 12000
      ? `[output truncated to final 12000 characters]\n${rawDetails.slice(-12000)}`
      : rawDetails
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}${details ? `\n${details}` : ''}`,
    )
  }
}

function assertSourceExports(entry, manifest) {
  const expectedExports = entry.componentExport
    ? { '.': rootExport, './style.css': './dist/style.css' }
    : { '.': rootExport }

  assert.deepEqual(
    manifest.exports,
    expectedExports,
    `${entry.name} export map changed unexpectedly`,
  )
  assert.equal(manifest.main, rootExport.require, `${entry.name} main mismatch`)
  assert.equal(manifest.module, rootExport.import, `${entry.name} module mismatch`)
  assert.equal(manifest.types, rootExport.types, `${entry.name} types mismatch`)
}

function assertNoWorkspaceProtocol(manifest) {
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      assert.equal(
        String(version).startsWith('workspace:'),
        false,
        `${manifest.name} packed ${section}.${name} still uses ${version}`,
      )
    }
  }
}

function assertPackedManifest(entry, sourceManifest, packedManifest, coreVersion) {
  assert.equal(packedManifest.name, sourceManifest.name)
  assert.equal(packedManifest.version, sourceManifest.version)

  for (const field of ['exports', 'main', 'module', 'types', 'sideEffects']) {
    assert.deepEqual(
      packedManifest[field],
      sourceManifest[field],
      `${entry.name} packed ${field} differs from source`,
    )
  }

  assert.equal(packedManifest.publishConfig?.access, sourceManifest.publishConfig?.access)
  assertNoWorkspaceProtocol(packedManifest)

  if (entry.componentExport) {
    assert.equal(
      packedManifest.dependencies?.['tiptap-vue-pro-core'],
      `^${coreVersion}`,
      `${entry.name} must pack with a caret range of the released core version`,
    )
  }
}

function installedVersion(projects, dependencyName) {
  for (const project of projects) {
    for (const section of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
    ]) {
      const version = project[section]?.[dependencyName]?.version
      if (version && !String(version).startsWith('link:'))
        return version
    }
  }

  throw new Error(`Cannot resolve installed version for ${dependencyName}`)
}

function writeConsumerFixture(consumerDirectory, tarballs, projects, tiptapPeerNames) {
  const dependencies = Object.fromEntries(
    packageMatrix.map(entry => [entry.name, `file:${tarballs.get(entry.name)}`]),
  )

  // Tiptap v3 家族必须整套装同一版本: 只装三件套时, 其余 peer 会被自动装成最新版,
  // 与锁定的旧版 core 混装后在运行时报错。这里按文档指引锁全套 workspace 版本。
  for (const name of [
    'vue',
    ...tiptapPeerNames,
    'element-plus',
    'naive-ui',
    'ant-design-vue',
  ]) {
    dependencies[name] = installedVersion(projects, name)
  }

  writeFileSync(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'tiptap-vue-pro-package-smoke',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: {
      '@vitejs/plugin-vue': installedVersion(projects, '@vitejs/plugin-vue'),
      typescript: installedVersion(projects, 'typescript'),
      vite: installedVersion(projects, 'vite'),
      'vue-tsc': installedVersion(projects, 'vue-tsc'),
    },
    pnpm: {
      overrides: {
        'tiptap-vue-pro-core': `file:${tarballs.get('tiptap-vue-pro-core')}`,
      },
    },
  }, null, 2)}\n`)

  writeFileSync(join(consumerDirectory, 'esm-core.mjs'), `
delete globalThis.window
delete globalThis.document

const core = await import('tiptap-vue-pro-core')

if (typeof core.useProEditor !== 'function')
  throw new Error('Missing core ESM export: useProEditor')
`)

  writeFileSync(join(consumerDirectory, 'ssr-entry.mjs'), `
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'

const elementPlus = { ProEditorElementPlus }
const naive = { ProEditorNaive }
const antDesignVue = { ProEditorAntDesignVue }

if (typeof elementPlus.ProEditorElementPlus !== 'object')
  throw new Error('Missing Element Plus ESM component')
if (typeof naive.ProEditorNaive !== 'object')
  throw new Error('Missing Naive UI ESM component')
if (typeof antDesignVue.ProEditorAntDesignVue !== 'object')
  throw new Error('Missing Ant Design Vue ESM component')
`)

  writeFileSync(join(consumerDirectory, 'vite.config.mjs'), `
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'ssr-entry.mjs',
    outDir: 'ssr-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'server.mjs',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
})
`)

  writeFileSync(join(consumerDirectory, 'commonjs.cjs'), `
delete globalThis.window
delete globalThis.document

const core = require('tiptap-vue-pro-core')
const elementPlus = require('tiptap-vue-pro-element-plus')
const naive = require('tiptap-vue-pro-naive')
const antDesignVue = require('tiptap-vue-pro-ant-design-vue')

if (typeof core.useProEditor !== 'function')
  throw new Error('Missing core CommonJS export: useProEditor')
if (typeof elementPlus.ProEditorElementPlus !== 'object')
  throw new Error('Missing Element Plus CommonJS component')
if (typeof naive.ProEditorNaive !== 'object')
  throw new Error('Missing Naive UI CommonJS component')
if (typeof antDesignVue.ProEditorAntDesignVue !== 'object')
  throw new Error('Missing Ant Design Vue CommonJS component')
`)

  writeFileSync(join(consumerDirectory, 'types.ts'), `
import {
  useProEditor,
  type ProEditorContext,
  type ToolbarOptions,
} from 'tiptap-vue-pro-core'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import type { Component } from 'vue'

const context: ProEditorContext | undefined = undefined
const toolbar: ToolbarOptions = {}
const components: Component[] = [
  ProEditorElementPlus,
  ProEditorNaive,
  ProEditorAntDesignVue,
]

void context
void toolbar
void components
void useProEditor
`)

  writeFileSync(join(consumerDirectory, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ['types.ts'],
  }, null, 2)}\n`)

  const appSourceDirectory = join(consumerDirectory, 'src')
  mkdirSync(appSourceDirectory)

  writeFileSync(join(consumerDirectory, 'index.html'), `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tiptap Vue Pro package smoke</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`)

  writeFileSync(join(appSourceDirectory, 'main.ts'), `
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`)

  writeFileSync(join(appSourceDirectory, 'App.vue'), `
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditorElementPlus } from 'tiptap-vue-pro-element-plus'
import 'tiptap-vue-pro-element-plus/style.css'
import { ProEditorNaive } from 'tiptap-vue-pro-naive'
import 'tiptap-vue-pro-naive/style.css'
import { ProEditorAntDesignVue } from 'tiptap-vue-pro-ant-design-vue'
import 'tiptap-vue-pro-ant-design-vue/style.css'

const elementPlusContent = ref('<p>Element Plus package smoke</p>')
const naiveContent = ref('<p>Naive UI package smoke</p>')
const antDesignVueContent = ref('<p>Ant Design Vue package smoke</p>')
</script>

<template>
  <main>
    <ProEditorElementPlus v-model="elementPlusContent" />
    <ProEditorNaive v-model="naiveContent" />
    <ProEditorAntDesignVue v-model="antDesignVueContent" />
  </main>
</template>
`)

  writeFileSync(join(consumerDirectory, 'vite.client.config.mjs'), `
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'client-dist',
    emptyOutDir: true,
  },
})
`)

  writeFileSync(join(consumerDirectory, 'tsconfig.app.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: true,
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      jsx: 'preserve',
      isolatedModules: true,
    },
    include: ['src/**/*.ts', 'src/**/*.vue'],
  }, null, 2)}\n`)
}

function main() {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'tiptap-vue-pro-pack-'))

  try {
    const sourceManifests = new Map()
    for (const entry of packageMatrix) {
      const manifest = readJson(join(repositoryRoot, entry.directory, 'package.json'))
      assertSourceExports(entry, manifest)
      sourceManifests.set(entry.name, manifest)
    }

    const coreVersion = sourceManifests.get('tiptap-vue-pro-core').version
    const tarballs = new Map()

    for (const entry of packageMatrix) {
      process.stdout.write(`Packing ${entry.name}... `)
      const output = run('pnpm', [
        '--filter',
        entry.name,
        'pack',
        '--pack-destination',
        tempDirectory,
        '--json',
      ])
      const packResult = JSON.parse(output)
      const tarball = Array.isArray(packResult)
        ? packResult[0]?.filename
        : packResult.filename

      assert.ok(tarball, `${entry.name} pack output did not include a filename`)
      tarballs.set(entry.name, tarball)

      const files = new Set(run('tar', ['-tf', tarball]).trim().split('\n'))
      for (const requiredFile of entry.requiredFiles) {
        assert.ok(
          files.has(requiredFile),
          `${entry.name} tarball is missing ${requiredFile}`,
        )
      }

      const packedManifest = JSON.parse(
        run('tar', ['-xOf', tarball, 'package/package.json']),
      )
      const declaration = run(
        'tar',
        ['-xOf', tarball, 'package/dist/index.d.ts'],
      )
      assert.doesNotMatch(
        declaration,
        /\bfrom\s+['"]\.{1,2}\//,
        `${entry.name} root declaration must not depend on relative declaration files`,
      )
      assert.match(
        declaration,
        new RegExp(entry.componentExport ?? 'useProEditor'),
        `${entry.name} root declaration is missing its representative export`,
      )
      assertPackedManifest(
        entry,
        sourceManifests.get(entry.name),
        packedManifest,
        coreVersion,
      )
      process.stdout.write('ok\n')
    }

    const projects = JSON.parse(run('pnpm', ['list', '-r', '--depth', '0', '--json']))
    const tiptapPeerNames = new Set()
    for (const manifest of sourceManifests.values()) {
      for (const name of Object.keys(manifest.peerDependencies ?? {})) {
        if (name.startsWith('@tiptap/'))
          tiptapPeerNames.add(name)
      }
    }
    const consumerDirectory = join(tempDirectory, 'consumer')
    mkdirSync(consumerDirectory)
    writeConsumerFixture(consumerDirectory, tarballs, projects, tiptapPeerNames)

    process.stdout.write('Installing packed packages... ')
    run('pnpm', ['install', '--ignore-scripts', '--prefer-offline'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Checking core ESM and SSR import... ')
    run('node', ['esm-core.mjs'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Checking adapter ESM SSR bundle... ')
    run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.config.mjs'], consumerDirectory)
    run('node', ['ssr-dist/server.mjs'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Checking CommonJS imports... ')
    run('node', ['commonjs.cjs'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Checking installed declarations... ')
    run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Typechecking a Vue/Vite consumer app... ')
    run('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', 'tsconfig.app.json'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Building a Vue/Vite consumer app... ')
    run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.client.config.mjs'], consumerDirectory)
    process.stdout.write('ok\n')

    process.stdout.write('Packed package verification passed.\n')
  }
  finally {
    rmSync(tempDirectory, { recursive: true, force: true })
  }
}

main()
