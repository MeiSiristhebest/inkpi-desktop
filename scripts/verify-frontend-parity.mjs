import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tauriRoot = path.join(desktopRoot, 'src-tauri')

const readText = (relativePath) => readFile(path.join(desktopRoot, relativePath), 'utf8')

const packageJson = JSON.parse(await readText('package.json'))
const tauriConfig = JSON.parse(await readFile(path.join(tauriRoot, 'tauri.conf.json'), 'utf8'))
const indexHtml = await readText('index.html')
const mainSource = await readText('src/main.tsx')
const appSource = await readText('src/App.tsx')
const distIndexHtml = await readText('dist/index.html')

const checks = [
  [packageJson.scripts?.dev === 'vite', 'Web dev script must be Vite'],
  [packageJson.scripts?.build?.includes('vite build'), 'Web build script must produce the Vite bundle'],
  [tauriConfig.build?.devUrl === 'http://localhost:5173', 'Tauri dev must use the Web Vite server'],
  [tauriConfig.build?.beforeDevCommand === 'npm run dev', 'Tauri dev must invoke the shared Web dev script'],
  [tauriConfig.build?.beforeBuildCommand === 'npm run build', 'Tauri packaging must invoke the shared Web build script'],
  [
    path.resolve(tauriRoot, tauriConfig.build?.frontendDist ?? '') === path.resolve(desktopRoot, 'dist'),
    'Tauri packaging must consume the shared dist directory',
  ],
  [indexHtml.includes('src="/src/main.tsx"'), 'Web HTML must mount the shared src/main.tsx entry'],
  [mainSource.includes("import App from './App.tsx'") && mainSource.includes('createRoot('), 'The shared entry must render App'],
  [appSource.includes("import { Engine } from './core/engine'") && appSource.includes('<Engine'), 'App must render the shared Engine'],
  [distIndexHtml.includes('src="./assets/') && distIndexHtml.includes('rel="stylesheet"'), 'Production dist must contain bundled assets'],
  [!distIndexHtml.includes('src="/src/main.tsx"'), 'Production dist must not point back to source files'],
]

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message)
if (failures.length > 0) {
  console.error('Frontend parity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Frontend parity check passed: Web and Tauri use the same entry, build command, and dist directory.')
}
