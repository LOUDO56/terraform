import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(here, "..", ".env"), "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const secret = process.env.WEBHOOK_SECRET ?? env.WEBHOOK_SECRET ?? "change-me-local-dev-secret";
const branch = process.env.DEPLOY_BRANCH ?? env.DEPLOY_BRANCH ?? "master";
const url = process.env.WEBHOOK_URL ?? "https://nextjs.local/api/webhook";

const payload = JSON.stringify({
  ref: `refs/heads/${branch}`,
  after: "local-test-commit",
  repository: { name: "s3-platform" },
});

const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Hub-Signature-256": signature,
  },
  body: payload,
});

console.log("HTTP", res.status);
console.log(await res.text());
