import { glob } from "glob";
import * as fs from "fs";

import { chromium } from "playwright";
import { renderToString } from "react-dom/server";
import React from "react";

import App from "./App";
import { Transaction } from "./types";
// import { aggregate } from "./multi-pass";
import { aggregate } from "./utils/single-pass";


(async () => {
  const files = await glob("transactions/*.json");
  console.log("files", files);

  const transactions: Transaction[] = files.map((filePath) => {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  });
  console.log("transactions", transactions);

  const result = aggregate(transactions);
  console.log("result", result);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const htmlContent = renderToString(
    <App result={result} />
  );

  await page.setContent(htmlContent);

  await page.emulateMedia({ media: "screen" });
  await page.pdf({ path: "page.pdf" });
})();
