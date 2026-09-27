import puppeteer from "puppeteer-core";

const BASE = process.env.B1_URL;
const CHROME = process.env.CHROME;
if (!BASE || !CHROME) throw new Error("B1_URL and CHROME are required");

const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const routes = { es: "/es/alertas", en: "/en/alerts" };
const categoryLabels = {
  es: {
    general_population: "AESAN · Interés general",
    allergy_intolerance_adverse: "AESAN · Alergias e intolerancias",
    food_supplements: "AESAN · Complementos alimenticios",
  },
  en: {
    general_population: "AESAN · General population",
    allergy_intolerance_adverse: "AESAN · Allergies and intolerances",
    food_supplements: "AESAN · Food supplements",
  },
};
const expectedTotals = {
  general_population: 59,
  allergy_intolerance_adverse: 54,
  food_supplements: 14,
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1365,900"],
});

const visible = async (page, selector) => page.$eval(selector, (el) => {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}).catch(() => false);

const waitReady = async (page) => {
  await page.waitForSelector(".na-terminal-results", { timeout: 60000 });
  await page.waitForFunction(() => {
    const root = document.querySelector(".na-terminal-results");
    return root?.getAttribute("aria-busy") === "false";
  }, { timeout: 60000 });
  await sleep(100);
};

const overflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, label + ": horizontal overflow " + JSON.stringify(metrics));
  assert(metrics.bodyScrollWidth <= metrics.clientWidth + 1, label + ": body horizontal overflow " + JSON.stringify(metrics));
  return metrics;
};

const gotoTerminal = async (page, path, label) => {
  const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response && response.status() === 200, label + ": HTTP " + String(response?.status()));
  await waitReady(page);
  await overflow(page, label);
};

const firstBadgeStyle = async (page) => page.$eval(".na-alert-card__aesan-type", (el) => {
  const style = getComputedStyle(el);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  };
});

const assertCategory = async (page, locale, code, label) => {
  await page.waitForSelector('.na-terminal-aesan-types input[name="aesanType"]', { timeout: 20000 });
  await page.evaluate((value) => {
    const input = [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')]
      .find((el) => el.value === value);
    if (!(input instanceof HTMLInputElement)) throw new Error("category radio missing: " + value);
    input.click();
  }, code);
  await page.waitForFunction((value) => {
    const url = new URL(location.href);
    return url.searchParams.get("aesanType") === value &&
      document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
  }, { timeout: 60000 }, code);

  const state = await page.evaluate((value, expectedLabel, expectedTotal) => {
    const input = [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')]
      .find((el) => el.value === value);
    const badges = [...document.querySelectorAll(".na-alert-card__aesan-type")];
    const cards = [...document.querySelectorAll(".na-alert-card")];
    const countText = document.querySelector(".na-terminal-results__count")?.textContent ?? "";
    return {
      checked: input instanceof HTMLInputElement && input.checked,
      badgeTexts: badges.map((item) => item.textContent?.trim() ?? ""),
      badgeCount: badges.length,
      cardCount: cards.length,
      countText,
      unexpectedSemantic: badges.some((item) =>
        /sever|risk|danger|critical|high|medium|low/i.test(
          item.className + " " + [...item.attributes].map((attr) => attr.name + "=" + attr.value).join(" ")
        )),
      allExpected: badges.every((item) => (item.textContent ?? "").trim() === expectedLabel),
      countMentionsTotal: countText.includes(String(expectedTotal)),
    };
  }, code, categoryLabels[locale][code], expectedTotals[code]);

  assert(state.checked, label + ": category radio not checked " + code);
  assert(state.cardCount > 0, label + ": no cards for " + code);
  assert(state.badgeCount === state.cardCount, label + ": known category card/badge mismatch " + code + " " + JSON.stringify(state));
  assert(state.allExpected, label + ": badge label mismatch " + code);
  assert(!state.unexpectedSemantic, label + ": taxonomy badge carries severity semantics " + code);
  assert(state.countMentionsTotal, label + ": results count does not show category total " + code);
  await overflow(page, label + "/" + code);
  return await firstBadgeStyle(page);
};

try {
  const matrix = [];
  for (const width of [1365, 390, 320]) {
    for (const locale of ["es", "en"]) {
      for (const theme of ["dark", "light"]) {
        const height = width === 1365 ? 900 : 844;
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
        await page.evaluateOnNewDocument((selectedTheme) => {
          localStorage.setItem("nagamealert-theme", selectedTheme);
        }, theme);

        const label = String(width) + "/" + locale + "/" + theme;
        await gotoTerminal(page, routes[locale] + "?period=all&source=AESAN", label);

        const shell = await page.evaluate(() => {
          const root = document.querySelector(".na-public-shell");
          const rootStyle = root ? getComputedStyle(root) : null;
          const allRadio = document.querySelector('.na-terminal-aesan-types input[value=""]');
          return {
            theme: document.documentElement.getAttribute("data-na-theme"),
            lang: document.documentElement.lang,
            source: document.querySelector('.na-terminal-tabs [data-source="AESAN"]')?.getAttribute("aria-current"),
            taxonomy: Boolean(document.querySelector(".na-terminal-aesan-types")),
            list: Boolean(document.querySelector(".na-alert-results__list")),
            map: Boolean(document.querySelector(".na-terminal-map")),
            allChecked: allRadio instanceof HTMLInputElement && allRadio.checked,
            visualSignature: rootStyle ? [rootStyle.color, rootStyle.backgroundColor, rootStyle.backgroundImage].join("|") : "",
          };
        });

        assert(shell.theme === theme, label + ": theme mismatch " + JSON.stringify(shell));
        assert(shell.lang === locale, label + ": lang mismatch");
        assert(shell.source === "page", label + ": AESAN source not active");
        assert(shell.taxonomy && shell.list && shell.map && shell.allChecked,
          label + ": base terminal surface incomplete " + JSON.stringify(shell));

        if (width < 600) {
          assert(await visible(page, ".na-terminal-filter-trigger"), label + ": mobile filter trigger hidden");
          await page.click(".na-terminal-filter-trigger");
          await page.waitForFunction(() => document.querySelector("details.na-terminal-filters")?.hasAttribute("open"));
          const drawer = await page.evaluate(() => {
            const panel = document.querySelector("#terminal-filter-panel");
            const style = panel ? getComputedStyle(panel) : null;
            const rect = panel?.getBoundingClientRect();
            return {
              open: document.querySelector("details.na-terminal-filters")?.hasAttribute("open"),
              panelVisible: Boolean(panel && rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden"),
              bodyPosition: document.body.style.position,
            };
          });
          assert(drawer.open && drawer.panelVisible && drawer.bodyPosition === "fixed",
            label + ": mobile drawer contract failed " + JSON.stringify(drawer));
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector("details.na-terminal-filters")?.hasAttribute("open"));
          await page.waitForFunction(() => document.body.style.position !== "fixed");
        }

        const styles = [];
        for (const code of ["general_population", "allergy_intolerance_adverse", "food_supplements"]) {
          styles.push({ code, style: await assertCategory(page, locale, code, label) });
        }
        const canonicalStyle = JSON.stringify(styles[0].style);
        for (const entry of styles.slice(1)) {
          assert(JSON.stringify(entry.style) === canonicalStyle,
            label + ": category styling differs by taxonomy/severity " + JSON.stringify(styles));
        }

        await page.evaluate(() => {
          const input = [...document.querySelectorAll('.na-terminal-aesan-types input[name="aesanType"]')]
            .find((el) => el.value === "");
          if (!(input instanceof HTMLInputElement)) throw new Error("all radio missing");
          input.click();
        });
        await page.waitForFunction(() =>
          !new URL(location.href).searchParams.has("aesanType") &&
          document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false",
          { timeout: 60000 }
        );
        const note = await page.$eval(".na-terminal-aesan-types small", (el) => el.textContent ?? "");
        assert(/1/.test(note), label + ": unknown/conflict disclosure missing");
        await overflow(page, label + "/all-final");

        matrix.push({ width, locale, theme, visualSignature: shell.visualSignature, status: "PASS" });
        await page.close();
      }
    }
  }

  for (const width of [1365, 390, 320]) {
    for (const locale of ["es", "en"]) {
      const dark = matrix.find((item) => item.width === width && item.locale === locale && item.theme === "dark");
      const light = matrix.find((item) => item.width === width && item.locale === locale && item.theme === "light");
      assert(dark && light && dark.visualSignature !== light.visualSignature,
        String(width) + "/" + locale + ": dark/light visual signatures did not differ");
    }
  }
  console.log("B1_BROWSER_MATRIX " + JSON.stringify({
    cases: matrix.length,
    matrix: matrix.map(({ width, locale, theme, status }) => ({ width, locale, theme, status })),
  }));

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("nagamealert-theme", "dark"));
    await gotoTerminal(page, "/es/alertas?period=all&source=AESAN", "interaction/base");

    const paginationButton = ".na-alert-pagination button";
    assert(await visible(page, paginationButton), "interaction: next-page button missing");
    await page.click(paginationButton);
    await page.waitForFunction(() => {
      const url = new URL(location.href);
      return url.searchParams.get("page") === "2" && Boolean(url.searchParams.get("cursor")) &&
        document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
    }, { timeout: 60000 });

    await page.evaluate(() => {
      const radio = document.querySelector('.na-terminal-aesan-types input[value="general_population"]');
      if (!(radio instanceof HTMLInputElement)) throw new Error("general_population radio absent");
      radio.click();
    });
    await page.waitForFunction(() => {
      const url = new URL(location.href);
      return url.searchParams.get("aesanType") === "general_population" &&
        !url.searchParams.has("cursor") && !url.searchParams.has("page") &&
        document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
    }, { timeout: 60000 });

    await page.click('.na-terminal-tabs [data-source="ALL"]');
    await page.waitForFunction(() => {
      const url = new URL(location.href);
      return !url.searchParams.has("source") && !url.searchParams.has("aesanType") &&
        document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
    }, { timeout: 60000 });
    assert(!(await page.$(".na-terminal-aesan-types")), "interaction: taxonomy remains visible outside AESAN");

    await page.click('.na-terminal-tabs [data-source="AESAN"]');
    await page.waitForFunction(() =>
      new URL(location.href).searchParams.get("source") === "AESAN" &&
      Boolean(document.querySelector(".na-terminal-aesan-types")) &&
      document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false",
      { timeout: 60000 }
    );

    await page.select("#terminal-period-desktop", "30d");
    await page.waitForFunction(() =>
      new URL(location.href).searchParams.get("period") === "30d" &&
      document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false",
      { timeout: 60000 }
    );
    await page.select("#terminal-country", "ES");
    await page.waitForFunction(() =>
      new URL(location.href).searchParams.get("country") === "ES" &&
      document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false",
      { timeout: 60000 }
    );

    await page.evaluate(() =>
      document.querySelectorAll('#terminal-filter-panel fieldset:not(.na-terminal-aesan-types) input[type="checkbox"]')[1]?.click()
    );
    await waitReady(page);
    await page.evaluate(() =>
      document.querySelectorAll('#terminal-filter-panel fieldset:not(.na-terminal-aesan-types) input[type="checkbox"]')[2]?.click()
    );
    await page.waitForFunction(() => {
      const url = new URL(location.href);
      return url.searchParams.getAll("domain").length === 1 && url.searchParams.get("domain") === "human_food" &&
        document.querySelector(".na-terminal-results")?.getAttribute("aria-busy") === "false";
    }, { timeout: 60000 });
    await overflow(page, "interaction/filters");

    await gotoTerminal(page, "/es/alertas?q=ES2026%2F266&period=all&source=AESAN", "interaction/search");
    const searchState = await page.evaluate(() => ({
      context: document.querySelector(".na-terminal__search-context")?.textContent ?? "",
      refs: [...document.querySelectorAll(".na-alert-card__reference")].map((item) => item.textContent ?? ""),
    }));
    assert(searchState.context.includes("ES2026/266"), "interaction: search context missing");
    assert(searchState.refs.some((item) => item.includes("ES2026/266")), "interaction: ES2026/266 search miss");

    console.log("B1_INTERACTIONS " + JSON.stringify({
      paginationReset: true,
      sourceSwitch: true,
      period: true,
      country: true,
      domain: true,
      search: true,
    }));
    await page.close();
  }

  for (const locale of ["es", "en"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("nagamealert-theme", "dark"));
    const cases = [
      { ref: "ES2026/266", kind: "known" },
      { ref: "ES2026/382", kind: "unknown" },
      { ref: "PREVIEW/CONFLICT", kind: "conflict" },
    ];

    for (const testCase of cases) {
      const label = "detail/" + locale + "/" + testCase.ref;
      await gotoTerminal(page,
        routes[locale] + "?q=" + encodeURIComponent(testCase.ref) + "&period=all&source=AESAN",
        label + "/list"
      );
      const card = await page.evaluate((ref) => {
        const found = [...document.querySelectorAll(".na-alert-card")]
          .find((item) => (item.textContent ?? "").includes(ref));
        if (!found) return null;
        return {
          href: found.querySelector(".na-alert-card__primary")?.getAttribute("href") ?? null,
          badge: found.querySelector(".na-alert-card__aesan-type")?.textContent?.trim() ?? null,
        };
      }, testCase.ref);
      assert(card?.href, label + ": card/href missing");
      if (testCase.kind === "known") assert(Boolean(card.badge), label + ": known badge missing");
      else assert(card.badge === null, label + ": unknown/conflict badge must be absent");

      const detailUrl = new URL(card.href, BASE).href;
      const response = await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      assert(response && response.status() === 200, label + ": HTTP " + String(response?.status()));
      await page.waitForSelector(".na-alert-detail__classification", { timeout: 60000 });
      const detail = await page.$eval(".na-alert-detail__classification", (el) => el.textContent ?? "");

      if (testCase.kind === "known") {
        assert(locale === "es" ? detail.includes("Clasificación AESAN") : detail.includes("AESAN classification"),
          label + ": known classification section missing");
      }
      if (testCase.kind === "unknown") {
        assert(locale === "es" ? detail.includes("Clasificación oficial no confirmada") : detail.includes("Official classification unconfirmed"),
          label + ": unknown wording mismatch");
      }
      if (testCase.kind === "conflict") {
        assert(locale === "es" ? detail.includes("Discrepancia entre publicaciones oficiales") : detail.includes("Discrepancy between official publications"),
          label + ": conflict wording mismatch");
      }
      await overflow(page, label);
    }
    await page.close();
  }
  console.log("B1_DETAILS status=PASS cases=6");
} finally {
  await browser.close();
}
