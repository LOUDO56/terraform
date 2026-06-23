import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { exec } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(signature: string | null, body: string, secret: string) {
  if (!signature) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET ?? "";
  const branch = process.env.DEPLOY_BRANCH ?? "master";
  const workdir = process.env.DEPLOY_WORKDIR ?? "/workspace";

  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!secret || !verifySignature(signature, body, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { ref?: string } = {};
  try {
    payload = JSON.parse(body);
  } catch {
    payload = {};
  }

  if (payload.ref && payload.ref !== `refs/heads/${branch}`) {
    return NextResponse.json({ skipped: `ref ${payload.ref} != ${branch}` });
  }

  const command = [
    `git -C ${workdir} fetch --all --prune`,
    `git -C ${workdir} checkout ${branch}`,
    `git -C ${workdir} pull --ff-only origin ${branch}`,
    `docker compose -f ${workdir}/docker-compose.yml up -d --build nextjs`,
  ].join(" && ");

  const child = exec(command, { env: process.env }, (err, stdout, stderr) => {
    if (err) {
      console.error("deploy failed", stderr || err.message);
    } else {
      console.log("deploy done", stdout);
    }
  });
  child.unref();

  return NextResponse.json({ status: "deploy triggered", branch });
}
