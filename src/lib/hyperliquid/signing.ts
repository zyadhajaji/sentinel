/**
 * Hyperliquid Order Signing — EIP-712 Phantom Agent
 *
 * How Hyperliquid signing works:
 * 1. Encode the action with msgpack
 * 2. Compute: connectionId = keccak256(msgpack(action) | nonce_u64_be | vault_flag)
 * 3. Sign EIP-712 typed data: Agent { source: "a", connectionId: bytes32 }
 * 4. Send: { action, nonce, signature: {r,s,v}, vaultAddress? }
 *
 * "a" = mainnet, "b" = testnet
 */

import { keccak256, toBytes, bytesToHex } from 'viem'
import { encode as msgpackEncode } from '@msgpack/msgpack'
import type { WalletClient } from 'viem'
import type { HLAction } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// EIP-712 Domain + Types (fixed for Hyperliquid)
// ─────────────────────────────────────────────────────────────────────────────

const HL_DOMAIN = {
  name: 'Exchange',
  version: '1',
  chainId: 1337,
  verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const

const AGENT_TYPES = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
} as const

const IS_MAINNET = true  // flip to false to target testnet

// ─────────────────────────────────────────────────────────────────────────────
// Action hash computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the connectionId (bytes32) for a Hyperliquid action.
 * connectionId = keccak256( msgpack(action) || nonce_uint64_be || vault_flag )
 */
function computeConnectionId(
  action: HLAction,
  nonce: number,
  vaultAddress: string | null,
): `0x${string}` {
  // 1. msgpack-encode the action object
  const msgPackBytes = msgpackEncode(action)

  // 2. Nonce as 8-byte big-endian uint64
  const nonceBuf = new ArrayBuffer(8)
  const view = new DataView(nonceBuf)
  view.setBigUint64(0, BigInt(nonce), false)
  const nonceBytes = new Uint8Array(nonceBuf)

  // 3. Vault address flag
  let vaultBytes: Uint8Array
  if (vaultAddress === null) {
    vaultBytes = new Uint8Array([0])  // 0x00 = no vault
  } else {
    const addrBytes = toBytes(vaultAddress as `0x${string}`)
    vaultBytes = new Uint8Array(21)
    vaultBytes[0] = 1
    vaultBytes.set(addrBytes, 1)
  }

  // 4. Concatenate and hash
  const combined = new Uint8Array(
    msgPackBytes.length + nonceBytes.length + vaultBytes.length
  )
  combined.set(msgPackBytes, 0)
  combined.set(nonceBytes, msgPackBytes.length)
  combined.set(vaultBytes, msgPackBytes.length + nonceBytes.length)

  return keccak256(combined)
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface HLSignature {
  r: string
  s: string
  v: number
}

function parseSig(sig: `0x${string}`): HLSignature {
  const bytes = toBytes(sig)
  const r = bytesToHex(bytes.slice(0, 32))
  const s = bytesToHex(bytes.slice(32, 64))
  // v: Ethereum uses 27/28, some wallets return 0/1 — normalise
  const rawV = bytes[64]!
  const v = rawV < 27 ? rawV + 27 : rawV
  return { r, s, v }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public signing function
// ─────────────────────────────────────────────────────────────────────────────

export interface SignedHLAction {
  action: HLAction
  nonce: number
  signature: HLSignature
  vaultAddress: string | null
}

/**
 * Sign a Hyperliquid action using a viem WalletClient.
 * The wallet must be connected (account must be set on the client).
 *
 * @param walletClient  viem WalletClient from useWalletClient()
 * @param action        The HL action object (order, cancel, updateLeverage, etc.)
 * @param vaultAddress  Optional vault address (null for personal trading)
 */
export async function signHLAction(
  walletClient: WalletClient,
  action: HLAction,
  vaultAddress: string | null = null,
): Promise<SignedHLAction> {
  if (!walletClient.account) {
    throw new Error('Wallet not connected — cannot sign Hyperliquid action')
  }

  const nonce = Date.now()
  const connectionId = computeConnectionId(action, nonce, vaultAddress)
  const source = IS_MAINNET ? 'a' : 'b'

  const rawSig = await walletClient.signTypedData({
    account: walletClient.account,
    domain: HL_DOMAIN,
    types: AGENT_TYPES,
    primaryType: 'Agent',
    message: { source, connectionId },
  })

  return {
    action,
    nonce,
    signature: parseSig(rawSig),
    vaultAddress,
  }
}
