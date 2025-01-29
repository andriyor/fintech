import { glob } from "glob";
import * as fs from "fs";

import { groupBy, sumBy } from "lodash";
import { chromium } from "playwright";
import { renderToString } from "react-dom/server";
import React from "react";

import App from "./App";

const amountByStatus = (transactions: []) => {
  const byStatus = groupBy(transactions, "status");
  return Object.entries(byStatus).reduce((prev, [key, val]) => {
    prev[key] = sumBy(val, "amount");
    return prev;
  }, {});
};

const amountBySource = (transactions: []) => {
  const byStatus = groupBy(transactions, "source");
  return Object.entries(byStatus).reduce((prev, [key, val]) => {
    prev[key] = sumBy(val, "amount");
    return prev;
  }, {});
};

(async () => {
  const files = await glob("transactions/*.json");
  console.log("files", files);

  const transactions = files.map((filePath) => {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  });
  console.log("transactions", transactions);

  const byStatus = amountByStatus(transactions);
  const bySource = amountBySource(transactions);
  console.log('bySource', bySource)

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const htmlContent = renderToString(
    <App byStatus={byStatus} bySource={bySource} />
  );

  await page.setContent(htmlContent);

  await page.emulateMedia({ media: "screen" });
  await page.pdf({ path: "page.pdf" });
})();
