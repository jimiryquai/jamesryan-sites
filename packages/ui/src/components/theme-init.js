// Inlined in <head> so a stored choice is applied before the body can paint.
(() => {
  const value = document.cookie.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith('theme='))?.slice(6);
  let preference = value === 'light' || value === 'dark' ? value : 'system';
  function apply() {
    const root = document.documentElement;
    root.classList.toggle('light', preference === 'light');
    root.classList.toggle('dark', preference === 'dark');
    root.style.colorScheme = preference === 'system' ? 'light dark' : preference;
  }
  window.siteTheme = {
    get preference() { return preference; },
    setPreference(value) {
      if (!['light', 'dark', 'system'].includes(value)) return;
      preference = value;
      document.cookie = `theme=${value === 'system' ? '' : value}; Path=/; SameSite=Lax; Max-Age=${value === 'system' ? 0 : 31536000}`;
      apply();
      window.dispatchEvent(new Event('themechange'));
    },
  };
  apply();
})();
