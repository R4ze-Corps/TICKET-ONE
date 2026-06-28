import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

interface RouteProps {
  params: Promise<{ code: string }>
}

export async function GET(_request: NextRequest, { params }: RouteProps) {
  try {
    const { code } = await params
    const db = await getDatabase()
    const collection = db.collection("transcripts")
    const transcript = await collection.findOne(
      { code: code.toUpperCase() },
      { projection: { _id: 0 } },
    )

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 },
      )
    }

    return NextResponse.json(transcript)
  } catch (error) {
    console.error("Error fetching transcript:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
