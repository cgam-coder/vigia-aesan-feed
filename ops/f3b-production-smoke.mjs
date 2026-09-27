import puppeteer from "puppeteer-core";

const BASE = process.env.PROD_URL;
const CHROME = process.env.CHROME;
if (!BASE || !CHROME) throw new Error("PROD_URL and CHROME are required");

const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const routes = { es: "/es/alertas", en: "/en/alerts" };
const categories = ["general_population", "allergy_intolerance_adverse", "food_supplements"];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1365,900"],
});

const waitReady = async (page) => {
  await page.waitForSelector(".na-terminal-results", { timeout: 60000 });
  await page.waitForFunction(() =>
    document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false",
    { timeout: 60000 }
  );
  await sleep(100);
};

const overflow = async (page, label) => {
  const state = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert(state.doc <= state.client + 1, label + ": document overflow " + JSON.stringify(state));
  assert(state.body <= state.client + 1, label + ": body overflow " + JSON.stringify(state));
};

const gotoTerminal = async (page, path, label) => {
  const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response && response.status() === 200, label + ": HTTP " + String(response?.status()));
  await waitReady(page);
  await overflow(page, label);
};

try {
  const matrix = [];
  for (const width of [1365, 390]) {
    for (const locale of ["es", "en"]) {
      for (const theme of ["dark", "light"]) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: width === 1365 ? 900 : 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
        await page.evaluateOnNewDocument((selected) => localStorage.setItem("nagamealert-theme", selected), theme);
        const label = "prod/" + String(width) + "/" + locale + "/" + theme;
        await gotoTerminal(page, routes[locale] + "?period=all&source=AESAN", label);

        const base = await page.evaluate(() => {
          const radios = [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')];
          const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";
          const img = document.querySelector("img")?.getAttribute("src") ?? "";
          return {
            theme: document.documentElement.getAttribute("data-na-theme"),
            lang: document.documentElement.lang,
            source: document.querySelector('.na-terminal-tabs [data-source="AESAN"]')?.getAttribute("aria-current"),
            taxonomy: Boolean(document.querySelector(".na-terminal-aesan-types")),
            radioValues: radios.map((item) => item.value),
            list: Boolean(document.querySelector(".na-alert-results__list")),
            map: Boolean(document.querySelector(".na-terminal-map")),
            canonical,
            img,
          };
        });
        assert(base.theme === theme, label + ": theme mismatch");
        assert(base.lang === locale, label + ": lang mismatch");
        assert(base.source === "page", label + ": source mismatch");
        assert(base.taxonomy && base.list && base.map, label + ": terminal surface incomplete");
        assert(JSON.stringify(base.radioValues) === JSON.stringify(["", ...categories]), label + ": taxonomy radios mismatch " + JSON.stringify(base.radioValues));
        assert(base.canonical === BASE + routes[locale], label + ": canonical mismatch " + base.canonical);

        if (base.img) {
          const asset = await page.evaluate(async (src) => {
            const response = await fetch(src, { cache: "no-store" });
            return { status: response.status, ok: response.ok };
          }, base.img);
          assert(asset.ok, label + ": primary image asset failed " + JSON.stringify(asset));
        }

        if (width < 600) {
          await page.waitForSelector(".na-terminal-filter-trigger", { visible: true, timeout: 20000 });
          await page.click(".na-terminal-filter-trigger");
          await page.waitForFunction(() => document.querySelector("details.na-terminal-filters")?.hasAttribute("open"));
          const bodyPosition = await page.evaluate(() => document.body.style.position);
          assert(bodyPosition === "fixed", label + ": drawer did not lock body");
          await page.keyboard.press("Escape");
          await page.waitForFunction(() =>
            !document.querySelector("details.na-terminal-filters")?.hasAttribute("open") &&
            document.body.style.position !== "fixed",
            { timeout: 20000 }
          );
        }

        for (const category of categories) {
          await page.evaluate((value) => {
            const input = [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')]
              .find((item) => item.value === value);
            if (!(input instanceof HTMLInputElement)) throw new Error("taxonomy radio absent: " + value);
            input.click();
          }, category);
          await page.waitForFunction((value) => {
            const url = new URL(location.href);
            return url.searchParams.get("aesanType") === value &&
              document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
          }, { timeout: 60000 }, category);
          const categoryState = await page.evaluate((value) => {
            const cards = [...document.querySelectorAll(".na-alert-card")];
            const badges = [...document.querySelectorAll(".na-alert-card__aesan-type")];
            return {
              cards: cards.length,
              badges: badges.length,
              semantic: badges.some((item) =>
                /sever|risk|danger|critical|high|medium|low/i.test(
                  item.className + " " + [...item.attributes].map((attr) => attr.name + "=" + attr.value).join(" ")
                )),
              selected: [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')]
                .some((item) => item.value === value && item instanceof HTMLInputElement && item.checked),
            };
          }, category);
          assert(categoryState.cards > 0 && categoryState.badges === categoryState.cards && categoryState.selected,
            label + ": category render mismatch " + category + " " + JSON.stringify(categoryState));
          assert(!categoryState.semantic, label + ": severity semantics leaked into taxonomy badge");
          await overflow(page, label + "/" + category);
        }

        matrix.push({ width, locale, theme, status: "PASS" });
        await page.close();
      }
    }
  }
  console.log("F3B_PROD_BROWSER_MATRIX " + JSON.stringify({ cases: matrix.length, matrix }));

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("nagamealert-theme", "dark"));
    await gotoTerminal(page, "/es/alertas?period=all&source=AESAN&aesanType=general_population", "prod/source-switch");
    await page.click('.na-terminal-tabs [data-source="ALL"]');
    await page.waitForFunction(() => {
      const url = new URL(location.href);
      return !url.searchParams.has("source") && !url.searchParams.has("aesanType") &&
        document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
    }, { timeout: 60000 });
    assert(!(await page.$(".na-terminal-aesan-types")), "prod/source-switch: taxonomy remained outside AESAN");
    await page.close();
  }
  console.log("F3B_PROD_SOURCE_SWITCH status=PASS");

  for (const locale of ["es", "en"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("nagamealert-theme", "dark"));
    for (const testCase of [
      { ref: "ES2026/266", kind: "known" },
      { ref: "ES2026/382", kind: "unknown" },
    ]) {
      const label = "prod/detail/" + locale + "/" + testCase.ref;
      await gotoTerminal(page, routes[locale] + "?q=" + encodeURIComponent(testCase.ref) + "&period=all&source=AESAN", label + "/list");
      const card = await page.evaluate((ref) => {
        const found = [...document.querySelectorAll(".na-alert-card")].find((item) => (item.textContent ?? "").includes(ref));
        if (!found) return null;
        return {
          href: found.querySelector(".na-alert-card__primary")?.getAttribute("href") ?? null,
          badge: found.querySelector(".na-alert-card__aesan-type")?.textContent?.trim() ?? null,
        };
      }, testCase.ref);
      assert(card?.href, label + ": card missing");
      if (testCase.kind === "known") assert(Boolean(card.badge), label + ": known badge missing");
      else assert(card.badge === null, label + ": unknown must not have known badge");

      const response = await page.goto(new URL(card.href, BASE).href, { waitUntil: "domcontentloaded", timeout: 60000 });
      assert(response && response.status() === 200, label + ": detail HTTP " + String(response?.status()));
      await page.waitForSelector(".na-alert-detail__classification", { timeout: 60000 });
      const detail = await page.$eval(".na-alert-detail__classification", (el) => el.textContent ?? "");
      if (testCase.kind === "known") {
        assert(locale === "es" ? detail.includes("Clasificación AESAN") : detail.includes("AESAN classification"),
          label + ": known detail classification missing");
      } else {
        assert(locale === "es" ? detail.includes("Clasificación oficial no confirmada") : detail.includes("Official classification unconfirmed"),
          label + ": unknown detail wording mismatch");
      }
      await overflow(page, label);
    }
    await page.close();
  }
  console.log("F3B_PROD_DETAILS status=PASS cases=4");
} finally {
  await browser.close();
}
