import { spawnSync } from 'child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const sdkRoot = join(projectRoot, '.android-sdk');
const jdkRoot = join(projectRoot, '.jdk');
const cmdlineRoot = join(sdkRoot, 'cmdline-tools', 'latest');
const isWin = process.platform === 'win32';
const sdkmanager = join(cmdlineRoot, 'bin', isWin ? 'sdkmanager.bat' : 'sdkmanager');
const TEMURIN_JDK_URL = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_windows_hotspot_21.0.6_7.zip';

const CMDLINE_URL = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
const PACKAGES = [
  'platform-tools',
  'platforms;android-35',
  'build-tools;35.0.0'
];

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
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function downloadFileNode(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const request = (urlStr) => {
      client.get(urlStr, { rejectUnauthorized: false }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(new URL(res.headers.location, urlStr).href);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${urlStr} (${res.statusCode})`));
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };

    request(url);
  });
}

function finalizeDownload(tempDest, dest) {
  if (existsSync(dest)) {
    try { unlinkSync(dest); } catch {}
  }
  try {
    renameSync(tempDest, dest);
  } catch {
    copyFileSync(tempDest, dest);
    try { unlinkSync(tempDest); } catch {}
  }
}

async function downloadFile(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const tempDest = `${dest}.part`;

  if (existsSync(dest) && statSync(dest).size > 100_000_000) {
    return;
  }

  if (existsSync(tempDest) && statSync(tempDest).size > 100_000_000) {
    console.log('[env] using existing partial download:', tempDest);
    finalizeDownload(tempDest, dest);
    return;
  }

  if (existsSync(tempDest)) {
    try { unlinkSync(tempDest); } catch {}
  }

  console.log('[env] downloading:', url);
  try {
    await downloadFileNode(url, tempDest);
    finalizeDownload(tempDest, dest);
  } catch (err) {
    if (existsSync(tempDest) && statSync(tempDest).size > 0) {
      console.warn('[env] download finished with warning, finalizing partial file:', err.message);
      finalizeDownload(tempDest, dest);
      return;
    }
    if (existsSync(tempDest)) {
      try { unlinkSync(tempDest); } catch {}
    }
    console.warn('[env] node download failed:', err.message);
    if (!isWin) throw err;
    run('powershell', [
      '-NoProfile',
      '-Command',
      `$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${tempDest.replace(/'/g, "''")}' -UseBasicParsing`
    ]);
    finalizeDownload(tempDest, dest);
  }

  if (!existsSync(dest)) {
    throw new Error(`Download failed: ${url}`);
  }
}

async function unzipWindows(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  run('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
  ]);
}

function findJavaHome() {
  const candidates = [];

  // Check if process.env.JAVA_HOME is Java 21
  if (process.env.JAVA_HOME && (process.env.JAVA_HOME.includes('21') || process.env.JAVA_HOME.includes('jdk-21'))) {
    candidates.push(process.env.JAVA_HOME);
  }

  // Check jdkRoot for any folder matching jdk-21
  if (existsSync(jdkRoot)) {
    try {
      const entries = readdirSync(jdkRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.startsWith('jdk-21'))
        .map(entry => join(jdkRoot, entry.name));
      candidates.push(...entries);
    } catch {}
  }

  const scanDirs = [
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java'
  ];

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(dir, entry.name))
        .filter(name => /jdk.*21|java.*21/i.test(name));
      candidates.push(...entries);
    } catch {}
  }

  for (const candidate of candidates.filter(Boolean)) {
    const javaBin = join(candidate, 'bin', isWin ? 'java.exe' : 'java');
    if (existsSync(javaBin)) return candidate;
  }
  return null;
}

async function downloadPortableJdk() {
  mkdirSync(jdkRoot, { recursive: true });
  const zipPath = join(jdkRoot, 'jdk.zip');
  console.log('[env] Downloading portable JDK 21...');
  await downloadFile(TEMURIN_JDK_URL, zipPath);
  await unzipWindows(zipPath, jdkRoot);
  const javaHome = findJavaHome();
  if (!javaHome) {
    throw new Error('Portable JDK 21 download finished but java.exe was not found.');
  }
  return javaHome;
}

async function ensureJava() {
  let javaHome = findJavaHome();
  if (javaHome) {
    console.log('[env] JAVA_HOME:', javaHome);
    return javaHome;
  }

  try {
    console.log('[env] Installing Microsoft OpenJDK 21 via winget...');
    run('winget', [
      'install',
      '--id', 'Microsoft.OpenJDK.21',
      '-e',
      '--source', 'winget',
      '--accept-source-agreements',
      '--accept-package-agreements'
    ]);
    javaHome = findJavaHome();
    if (javaHome) {
      console.log('[env] JAVA_HOME:', javaHome);
      return javaHome;
    }
    console.warn('[env] winget install finished but java.exe was not found yet.');
  } catch (err) {
    console.warn('[env] winget install failed, falling back to portable JDK download.');
  }

  const hasLocalJdk21 = existsSync(jdkRoot) && readdirSync(jdkRoot).some(name => name.startsWith('jdk-21'));
  if (!hasLocalJdk21) {
    javaHome = await downloadPortableJdk();
  } else {
    javaHome = findJavaHome();
  }
  if (!javaHome) {
    throw new Error('Java 21 is required. Install Microsoft OpenJDK 21, then rerun npm run build:apk');
  }
  console.log('[env] JAVA_HOME:', javaHome);
  return javaHome;
}

async function ensureAndroidSdk(javaHome) {
  mkdirSync(sdkRoot, { recursive: true });

  if (!existsSync(sdkmanager)) {
    console.log('[env] Downloading Android command-line tools...');
    const zipPath = join(sdkRoot, 'cmdline-tools.zip');
    await downloadFile(CMDLINE_URL, zipPath);

    const tempExtract = join(sdkRoot, 'cmdline-tools-temp');
    await unzipWindows(zipPath, tempExtract);

    mkdirSync(join(sdkRoot, 'cmdline-tools'), { recursive: true });
    const extractedLatest = join(tempExtract, 'cmdline-tools');
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Move-Item -Path '${join(extractedLatest, '*').replace(/'/g, "''")}' -Destination '${join(sdkRoot, 'cmdline-tools', 'latest').replace(/'/g, "''")}' -Force`
    ]);
  }

  const localProps = join(projectRoot, 'android', 'local.properties');
  const sdkDirEscaped = sdkRoot.replace(/\\/g, '\\\\');
  writeFileSync(localProps, `sdk.dir=${sdkDirEscaped}\n`, 'utf8');
  console.log('[env] wrote android/local.properties');

  console.log('[env] Accepting Android SDK licenses...');
  const licenseInput = join(sdkRoot, 'license-yes.txt');
  writeFileSync(licenseInput, Array(50).fill('y\n').join(''), 'utf8');
  try {
    run('cmd', ['/c', `type "${licenseInput}" | "${sdkmanager}" --licenses --sdk_root="${sdkRoot}"`], {
      env: {
        JAVA_HOME: javaHome,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot
      }
    });
  } catch (err) {
    console.warn('[env] Failed to update/accept licenses online (likely offline). Proceeding...');
  }

  try {
    console.log('[env] Installing Android SDK packages (first run may take several minutes)...');
    run(sdkmanager, [...PACKAGES, '--sdk_root=' + sdkRoot], {
      env: {
        JAVA_HOME: javaHome,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot
      }
    });
  } catch (err) {
    const hasPlatformTools = existsSync(join(sdkRoot, 'platform-tools'));
    const hasPlatform35 = existsSync(join(sdkRoot, 'platforms', 'android-35'));
    const hasBuildTools35 = existsSync(join(sdkRoot, 'build-tools', '35.0.0'));
    if (hasPlatformTools && hasPlatform35 && hasBuildTools35) {
      console.warn('[env] sdkmanager failed (likely network timeout), but required packages exist locally. Continuing...');
    } else {
      throw err;
    }
  }

  return sdkRoot;
}

export async function setupBuildEnvironment() {
  const javaHome = await ensureJava();
  const androidHome = await ensureAndroidSdk(javaHome);
  return { javaHome, androidHome };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/')) {
  setupBuildEnvironment().catch(err => {
    console.error('[env] setup failed:', err.message);
    process.exit(1);
  });
}
