import { NextResponse } from "next/server";
import {
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { hotClient, coldClient, HOT_BUCKET, COLD_BUCKET } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const listed = await coldClient.send(
      new ListObjectsV2Command({ Bucket: COLD_BUCKET })
    );
    const objects = listed.Contents ?? [];
    const restored: string[] = [];

    for (const obj of objects) {
      if (!obj.Key) continue;
      const got = await coldClient.send(
        new GetObjectCommand({ Bucket: COLD_BUCKET, Key: obj.Key })
      );
      const bytes = await got.Body!.transformToByteArray();
      await hotClient.send(
        new PutObjectCommand({
          Bucket: HOT_BUCKET,
          Key: obj.Key,
          Body: Buffer.from(bytes),
          ContentType: got.ContentType || "application/octet-stream",
        })
      );
      restored.push(obj.Key);
    }

    return NextResponse.json({ restored });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
