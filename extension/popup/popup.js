(function () {
  const i18n = window.__YT_PDS_I18N__;
  if (!i18n) return;

  const SETTINGS_KEY = 'ytpds:settings';
  const UI_TEXT = {
    ja: {
      title: 'Playlist Date Sorter',
      languageLabel: '表示言語',
      saved: '保存しました。',
      error: '設定を保存できませんでした。',
    },
    en: {
      title: 'Playlist Date Sorter',
      languageLabel: 'Language',
      saved: 'Saved.',
      error: 'Could not save settings.',
    },
  };

  const languageSelect = document.querySelector('[data-popup-language]');
  const status = document.querySelector('[data-popup-status]');

  function text(language, key) {
    const normalized = i18n.normalizeLanguage(language);
    return (UI_TEXT[normalized] && UI_TEXT[normalized][key]) || UI_TEXT.ja[key] || '';
  }

  function normalizeSettings(settings) {
    return {
      language: i18n.normalizeLanguage(settings && settings.language),
      panelCollapsed: Boolean(settings && settings.panelCollapsed),
    };
  }

  function render(settings, messageKey) {
    const normalizedSettings = normalizeSettings(settings);
    const normalized = normalizedSettings.language;
    document.documentElement.lang = normalized;
    document.querySelector('[data-popup-title]').textContent = text(normalized, 'title');
    document.querySelector('[data-popup-language-label]').textContent = text(normalized, 'languageLabel');
    languageSelect.value = normalized;
    status.textContent = messageKey ? text(normalized, messageKey) : '';
  }

  function canUseChromeStorage() {
    return Boolean(
      typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        chrome.storage.local.get &&
        chrome.storage.local.set
    );
  }

  function storageGet(key) {
    if (!canUseChromeStorage()) return Promise.resolve(null);
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result && result[key] ? result[key] : null);
      });
    });
  }

  function storageSet(key, value) {
    if (!canUseChromeStorage()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async function restoreSettings() {
    const saved = await storageGet(SETTINGS_KEY);
    render(saved);
  }

  languageSelect.addEventListener('change', async (event) => {
    const saved = normalizeSettings(await storageGet(SETTINGS_KEY));
    const settings = {
      language: i18n.normalizeLanguage(event.target.value),
      panelCollapsed: saved.panelCollapsed,
    };
    render(settings);
    try {
      await storageSet(SETTINGS_KEY, settings);
      render(settings, 'saved');
    } catch (_) {
      render(settings, 'error');
    }
  });

  restoreSettings();
})();
