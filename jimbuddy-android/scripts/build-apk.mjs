import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { setupBuildEnvironment } from './setup-build-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const releasesDir = join(projectRoot, 'releases');
const isWin = process.platform === 'win32';
const gradlew = join(projectRoot, 'android', isWin ? 'gradlew.bat' : 'gradlew');

function run(cmd, args, opts = {}) {
  let result;
  if (isWin) {
    const quotedCmd = cmd.includes(' ') && !cmd.startsWith('"') ? `"${cmd}"` : cmd;
    const quotedArgs = args.map(arg => {
      if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
        if (arg.startsWith('--')) {
          const eqIdx = arg.indexOf('=');
          if (eqIdx !== -1) {
            const key = arg.substring(0, eqIdx);
            const val = arg.substring(eqIdx + 1);
            return `${key}="${val}"`;
          }
        }
        return `"${arg}"`;
      }
      return arg;
    });
    const cmdLine = `${quotedCmd} ${quotedArgs.join(' ')}`;
    result = spawnSync(cmdLine, [], {
      cwd: opts.cwd || projectRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ...opts.env }
    });
  } else {
    result = spawnSync(cmd, args, {
      cwd: opts.cwd || projectRoot,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...opts.env }
    });
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const { javaHome, androidHome } = await setupBuildEnvironment();

console.log('[build] syncing web assets...');
run('npm', ['run', 'sync:web'], { env: { JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome } });

console.log('[build] syncing capacitor android project...');
run('npx', ['cap', 'sync', 'android'], { env: { JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome } });

if (!existsSync(gradlew)) {
  console.error('[build] gradlew not found. Run: npx cap add android');
  process.exit(1);
}

console.log('[build] assembling debug APK (installable on Android)...');
run(isWin ? gradlew : gradlew, ['assembleDebug'], {
  cwd: join(projectRoot, 'android'),
  env: { JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
});

const apkSrc = join(
  projectRoot,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk'
);

if (!existsSync(apkSrc)) {
  console.error('[build] APK output not found at', apkSrc);
  process.exit(1);
}

mkdirSync(releasesDir, { recursive: true });
const apkDest = join(releasesDir, 'JimBuddy.apk');
cpSync(apkSrc, apkDest);
console.log('\n[build] SUCCESS');
console.log('[build] APK ready:', apkDest);
