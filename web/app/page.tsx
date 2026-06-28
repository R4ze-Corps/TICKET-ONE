"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Search } from "lucide-react"
import { Header } from "@/components/transcript/header"

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState("")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const transcriptCode = code.trim().replace(/^#/, "")
    if (!transcriptCode) return

    router.push(`/transcript/${encodeURIComponent(transcriptCode)}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="border border-border bg-card rounded-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-md bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Buscar Transcript
              </h1>
              <p className="text-sm text-muted-foreground">
                Digite o codigo gerado pelo bot ao finalizar o ticket.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ex: 380GACM"
              className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-11 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              disabled={!code.trim()}
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
