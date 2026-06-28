import { notFound } from "next/navigation"
import { getDatabase } from "@/lib/mongodb"
import { TranscriptViewer } from "@/components/transcript/transcript-viewer"
import type { Transcript } from "@/lib/types"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ code: string }>
}

function messageTimestamp(createdAt: Date, time?: string) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return createdAt.toISOString()

  const [hours, minutes] = time.split(":").map(Number)
  const date = new Date(createdAt)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function normalizeTranscript(document: any): Transcript {
  const createdAt = document.createdAt ? new Date(document.createdAt) : new Date()
  const firstMember = document.messages?.find((message: any) => message.role !== "agent")

  return {
    id: document.code,
    guildId: document.serverName || "server",
    guildName: document.serverName,
    channelId: document.code,
    channelName: document.title,
    category: "Atendimento",
    description: document.duration ? `Duração: ${document.duration}` : undefined,
    createdAt: createdAt.toISOString(),
    closedAt: createdAt.toISOString(),
    openedBy: {
      id: "member",
      username: firstMember?.author || "Cliente",
      avatar: firstMember?.avatar,
    },
    closedBy: document.agent
      ? {
          id: "agent",
          username: document.agent,
          avatar: document.messages?.find((message: any) => message.role === "agent")?.avatar,
        }
      : undefined,
    messageCount: document.messages?.length || 0,
    messages: (document.messages || []).map((message: any, index: number) => ({
      id: `${document.code}-${index}`,
      messageId: `${document.code}-${index}`,
      authorId: message.role || "member",
      authorUsername: message.author,
      authorAvatar: message.avatar,
      authorBot: false,
      isStaff: message.role === "agent",
      content: message.content,
      timestamp: messageTimestamp(createdAt, message.time),
    })),
  }
}

async function getTranscript(code: string): Promise<Transcript | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection("transcripts")
    const transcript = await collection.findOne(
      { code: code.toUpperCase() },
      { projection: { _id: 0 } },
    )

    return transcript ? normalizeTranscript(transcript) : null
  } catch (error) {
    console.error("Error fetching transcript:", error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const transcript = await getTranscript(code)

  if (!transcript) {
    return {
      title: "Transcript nao encontrado",
    }
  }

  return {
    title: `Transcript #${transcript.id}`,
    description: `${transcript.messageCount} mensagens`,
  }
}

export default async function TranscriptPage({ params }: PageProps) {
  const { code } = await params
  const transcript = await getTranscript(code)

  if (!transcript) {
    notFound()
  }

  return <TranscriptViewer transcript={transcript} />
}
