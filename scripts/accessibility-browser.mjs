// Own the browser boundary: visitor theme, allowed requests and usable stylesheets.
export async function openAccessibilityPage(browser, origin, mode, { recordVideo } = {}) {
  origin = new URL(origin).origin;
  const context = await browser.newContext({ colorScheme: mode, viewport: { width: 1440, height: 1000 }, recordVideo });
  await context.addCookies([{ name: 'theme', value: mode, url: origin }]);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || ['data:', 'blob:', 'about:'].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const stylesheetErrors = [];
  page.on('response', response => {
    if (response.request().resourceType() === 'stylesheet' && !response.ok()) stylesheetErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    if (request.resourceType() === 'stylesheet') stylesheetErrors.push(request.url());
  });
  return {
    page,
    async visit(path) {
      const response = await page.goto(new URL(path, origin).href, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${mode} ${path}: HTTP ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      if (stylesheetErrors.length) throw new Error(`Stylesheets failed to load: ${stylesheetErrors.join(', ')}`);
    },
    close: () => context.close(),
  };
}
