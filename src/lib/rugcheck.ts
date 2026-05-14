const BASE = 'https://api.rugcheck.xyz/v1'

export interface RugReport {
  score: number        // 0-1000, higher = safer
  risks: string[]      // danger/warn risk names e.g. "Top 10 Holders", "Mintable"
  topHolderPct: number // largest single holder percentage
}

export async function fetchRugReport(mint: string): Promise<RugReport | null> {
  try {
    const r = await fetch(`${BASE}/tokens/${mint}/report/summary`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const data = await r.json()

    const topHolderRaw = data.topHolders?.[0]?.pct ?? 0
    // RugCheck returns pct as a decimal (0-1) or whole number — normalise
    const topHolderPct = topHolderRaw > 1 ? topHolderRaw : topHolderRaw * 100

    const risks: string[] = (data.risks ?? [])
      .filter((r: { level: string }) => r.level === 'danger' || r.level === 'warn')
      .map((r: { name: string }) => r.name as string)

    return {
      score: typeof data.score === 'number' ? data.score : 500,
      risks,
      topHolderPct: Math.round(topHolderPct * 10) / 10,
    }
  } catch {
    return null
  }
}
