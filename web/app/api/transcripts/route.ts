import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

function createTranscriptCode() {
  return Math.random().toString(36).slice(2, 9).toUpperCase()
}

async function ensureTtlIndex(collection: any) {
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json()

    if (!payload.serverName || !payload.title || !Array.isArray(payload.messages)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      )
    }

    const db = await getDatabase()
    const collection = db.collection("transcripts")
    await ensureTtlIndex(collection)

    let code = createTranscriptCode()
    while (await collection.findOne({ code })) {
      code = createTranscriptCode()
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    await collection.insertOne({
      code,
      serverName: payload.serverName,
      serverIcon: payload.serverIcon,
      title: payload.title,
      agent: payload.agent,
      duration: payload.duration,
      messages: payload.messages,
      createdAt: now,
      expiresAt,
    })

    return NextResponse.json({
      code,
      url: `/transcript/${code}`,
    })
  } catch (error) {
    console.error("Error creating transcript:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20", 10)

    const db = await getDatabase()
    const collection = db.collection("transcripts")
    const transcripts = await collection
      .find({}, { projection: { _id: 0, messages: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({ transcripts })
  } catch (error) {
    console.error("Error listing transcripts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
