import { glob } from "glob";
import * as fs from "fs";

import { groupBy, sumBy } from "lodash";
import { chromium } from "playwright";
import { renderToString } from "react-dom/server";
import React from "react";

import App from "./App";

(async () => {
  const files = await glob("transactions/*.json");
  console.log("files", files);

  const transactions = files.map((filePath) => {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  });
  console.log("transactions", transactions);

  const byStatus = groupBy(transactions, "status");
  console.log("byStatus", byStatus);
  const agrigaterResult = Object.entries(byStatus).reduce((prev, [key, val]) => {
    prev[key] = sumBy(val, 'amount')
    return prev;
  }, {})

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const htmlContent = renderToString(<App byStatus={agrigaterResult} />);

  await page.setContent(htmlContent);

  await page.emulateMedia({ media: "screen" });
  await page.pdf({ path: "page.pdf" });
})();
