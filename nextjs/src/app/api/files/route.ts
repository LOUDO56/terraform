import { NextRequest, NextResponse } from "next/server";
import {
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { hotClient, HOT_BUCKET } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const out = await hotClient.send(
      new ListObjectsV2Command({ Bucket: HOT_BUCKET })
    );
    const files = (out.Contents ?? []).map((o) => ({
      key: o.Key ?? "",
      size: o.Size ?? 0,
      lastModified: o.LastModified ? o.LastModified.toISOString() : null,
    }));
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const entries = form.getAll("files");
    const files = entries.filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "no files provided" }, { status: 400 });
    }
    const uploaded: { name: string; size: number }[] = [];
    for (const file of files) {
      const body = Buffer.from(await file.arrayBuffer());
      await hotClient.send(
        new PutObjectCommand({
          Bucket: HOT_BUCKET,
          Key: file.name,
          Body: body,
          ContentType: file.type || "application/octet-stream",
        })
      );
      uploaded.push({ name: file.name, size: body.length });
    }
    return NextResponse.json({ uploaded });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
