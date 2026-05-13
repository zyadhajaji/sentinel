export interface PumpFunToken {
  mint: string
  name: string
  symbol: string
  uri: string
  traderPublicKey: string
  bondingCurveKey: string
  vSolInBondingCurve: number
  vTokensInBondingCurve: number
  initialBuy: number
  marketCapSol: number
}

type TokenHandler = (token: PumpFunToken) => void

export class PumpFunWS {
  private ws: WebSocket | null = null
  private handler: TokenHandler
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(handler: TokenHandler) {
    this.handler = handler
    this.connect()
  }

  private connect() {
    if (this.destroyed) return
    try {
      this.ws = new WebSocket('wss://pumpportal.fun/api/data')

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({ method: 'subscribeNewToken' }))
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.mint && data.name) {
            this.handler(data as PumpFunToken)
          }
        } catch {}
      }

      this.ws.onclose = () => {
        if (!this.destroyed) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000)
        }
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {}
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}
