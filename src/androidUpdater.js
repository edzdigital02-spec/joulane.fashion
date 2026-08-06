import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const UPDATE_MANIFEST_URL = 'https://www.joulanefashion.com/android-updates.json';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SNOOZE_MS = 60 * 60 * 1000;

let updateCheckPromise = null;
let lastCheckedAt = 0;
let activeUpdate = null;

function numericBuild(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function snoozeKey(appId, build) {
  return `joulane_android_update_snooze_${appId}_${build}`;
}

function isSnoozed(appId, build) {
  try {
    return Number(localStorage.getItem(snoozeKey(appId, build)) || 0) > Date.now();
  } catch (_) {
    return false;
  }
}

function snooze(appId, build, duration = SNOOZE_MS) {
  try {
    localStorage.setItem(snoozeKey(appId, build), String(Date.now() + duration));
  } catch (_) {
    // A storage failure must never block access to the app.
  }
}

function ensureStyles() {
  if (document.getElementById('joulane-android-update-styles')) return;
  const style = document.createElement('style');
  style.id = 'joulane-android-update-styles';
  style.textContent = `
    .android-update-overlay {
      position: fixed;
      inset: 0;
      z-index: 30000;
      display: grid;
      place-items: center;
      padding: max(18px, env(safe-area-inset-top, 0px)) 18px max(18px, env(safe-area-inset-bottom, 0px));
      background: rgba(5, 5, 4, 0.82);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      animation: android-update-fade 220ms ease both;
    }
    .android-update-card {
      position: relative;
      width: min(440px, 100%);
      max-height: min(720px, calc(100dvh - 36px));
      overflow: auto;
      padding: 28px 22px 22px;
      border: 1px solid rgba(229, 193, 88, 0.46);
      border-radius: 26px;
      color: #fffaf1;
      background:
        radial-gradient(circle at 50% -15%, rgba(229, 193, 88, 0.2), transparent 46%),
        linear-gradient(160deg, #1b1914, #0c0c0a 72%);
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      font-family: "Cairo", "Segoe UI", Tahoma, sans-serif;
      text-align: center;
      overscroll-behavior: contain;
    }
    .android-update-icon {
      width: 72px;
      height: 72px;
      display: grid;
      place-items: center;
      margin: 0 auto 14px;
      border: 1px solid rgba(255, 242, 198, 0.8);
      border-radius: 24px;
      color: #171106;
      background: linear-gradient(135deg, #fff0bd, #e5c158 50%, #9b741c);
      box-shadow: 0 14px 36px rgba(229, 193, 88, 0.28);
      font-size: 2rem;
      transform: rotate(-5deg);
    }
    .android-update-card h2 { margin: 0; color: #ffebb8; font-size: 1.35rem; line-height: 1.45; }
    .android-update-subtitle { margin: 7px 0 0; color: #d8cebf; font-size: 0.86rem; line-height: 1.7; }
    .android-update-version {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin: 14px auto;
      padding: 7px 12px;
      border: 1px solid rgba(229, 193, 88, 0.28);
      border-radius: 999px;
      color: #e5c158;
      background: rgba(229, 193, 88, 0.08);
      direction: ltr;
      font-size: 0.76rem;
      font-weight: 900;
    }
    .android-update-notes {
      margin: 0 0 16px;
      padding: 14px 16px;
      border: 1px solid rgba(229, 193, 88, 0.16);
      border-radius: 17px;
      color: #f5efe5;
      background: rgba(255, 255, 255, 0.035);
      font-size: 0.8rem;
      line-height: 1.75;
      text-align: start;
    }
    .android-update-notes li + li { margin-top: 5px; }
    .android-update-security { margin: 0 0 16px; color: #aead9e; font-size: 0.7rem; line-height: 1.65; }
    .android-update-actions { display: grid; grid-template-columns: 1fr; gap: 9px; }
    .android-update-button {
      min-height: 50px;
      border: 0;
      border-radius: 999px;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 900;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .android-update-button--primary {
      color: #171106;
      background: linear-gradient(135deg, #fff0bd, #e5c158 50%, #9b741c);
      box-shadow: 0 10px 28px rgba(229, 193, 88, 0.24);
    }
    .android-update-button--later { color: #d8cebf; background: rgba(255, 255, 255, 0.065); }
    .android-update-button[disabled] { cursor: wait; opacity: 0.68; }
    .android-update-status { min-height: 1.4em; margin: 10px 0 0; color: #e5c158; font-size: 0.72rem; font-weight: 800; }
    @keyframes android-update-fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .android-update-overlay { animation: none; } }
  `;
  document.head.appendChild(style);
}

function closeUpdatePrompt() {
  document.getElementById('joulane-android-update')?.remove();
  activeUpdate = null;
}

function renderUpdatePrompt(appInfo, release) {
  if (activeUpdate?.build === release.versionCode) return;
  closeUpdatePrompt();
  ensureStyles();

  const overlay = document.createElement('div');
  overlay.id = 'joulane-android-update';
  overlay.className = 'android-update-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'android-update-title');
  overlay.dir = 'rtl';

  const card = document.createElement('section');
  card.className = 'android-update-card';
  card.innerHTML = `
    <div class="android-update-icon" aria-hidden="true">↻</div>
    <h2 id="android-update-title">تحديث جديد متوفر</h2>
    <p class="android-update-subtitle"></p>
    <div class="android-update-version"></div>
    <ul class="android-update-notes"></ul>
    <p class="android-update-security">سيُثبَّت التحديث فوق التطبيق الحالي دون حذف الطلبات أو البيانات المحفوظة.</p>
    <div class="android-update-actions">
      <button type="button" class="android-update-button android-update-button--primary">تحديث التطبيق الآن</button>
      <button type="button" class="android-update-button android-update-button--later">لاحقًا</button>
    </div>
    <p class="android-update-status" role="status" aria-live="polite"></p>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const subtitle = card.querySelector('.android-update-subtitle');
  const version = card.querySelector('.android-update-version');
  const notes = card.querySelector('.android-update-notes');
  const updateButton = card.querySelector('.android-update-button--primary');
  const laterButton = card.querySelector('.android-update-button--later');
  const status = card.querySelector('.android-update-status');

  subtitle.textContent = `يتوفر إصدار أحدث من ${release.appName || appInfo.name}.`;
  version.textContent = `${appInfo.version}  ←  ${release.versionName}`;
  const releaseNotes = Array.isArray(release.notesAr) && release.notesAr.length
    ? release.notesAr
    : ['تحسينات جديدة في الواجهة والأداء.'];
  releaseNotes.slice(0, 6).forEach(note => {
    const item = document.createElement('li');
    item.textContent = String(note);
    notes.appendChild(item);
  });

  if (release.required === true) {
    laterButton.hidden = true;
  } else {
    laterButton.addEventListener('click', () => {
      snooze(appInfo.id, release.versionCode);
      closeUpdatePrompt();
    });
  }

  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    laterButton.disabled = true;
    status.textContent = 'جارٍ فتح ملف التحديث الآمن...';
    snooze(appInfo.id, release.versionCode, 30 * 60 * 1000);
    try {
      const downloadUrl = new URL(release.apkUrl);
      downloadUrl.searchParams.set('build', String(release.versionCode));
      await Browser.open({ url: downloadUrl.href });
      status.textContent = 'بعد التنزيل، افتح الملف واضغط «تحديث». لا تحذف التطبيق الحالي.';
    } catch (_) {
      status.textContent = 'تعذر فتح التنزيل. تحقق من الإنترنت وحاول مجددًا.';
      updateButton.disabled = false;
      laterButton.disabled = false;
    }
  });

  activeUpdate = { build: release.versionCode, appId: appInfo.id };
  window.setTimeout(() => updateButton.focus(), 80);
}

async function fetchUpdateManifest() {
  const url = new URL(UPDATE_MANIFEST_URL);
  url.searchParams.set('t', String(Date.now()));
  const response = await fetch(url.href, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Update manifest returned ${response.status}`);
  return response.json();
}

async function checkForAndroidUpdate({ force = false } = {}) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  if (!force && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) return;
  if (updateCheckPromise) return updateCheckPromise;

  updateCheckPromise = (async () => {
    lastCheckedAt = Date.now();
    const [appInfo, manifest] = await Promise.all([App.getInfo(), fetchUpdateManifest()]);
    const release = manifest?.apps?.[appInfo.id];
    if (!release?.apkUrl || numericBuild(release.versionCode) <= numericBuild(appInfo.build)) return;
    release.versionCode = numericBuild(release.versionCode);
    if (release.required !== true && isSnoozed(appInfo.id, release.versionCode)) return;
    renderUpdatePrompt(appInfo, release);
  })().catch(() => {
    // Offline use remains available; the next foreground check will retry.
  }).finally(() => {
    updateCheckPromise = null;
  });

  return updateCheckPromise;
}

function bootAndroidUpdater() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  const start = () => checkForAndroidUpdate({ force: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) checkForAndroidUpdate();
  });
}

bootAndroidUpdater();

export { checkForAndroidUpdate };
