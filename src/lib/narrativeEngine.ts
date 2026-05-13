const NARRATIVES: Record<string, string[]> = {
  AI:       ['ai', 'gpt', 'neural', 'agent', 'llm', 'agi', 'openai', 'gemini', 'claude', 'copilot', 'robot', 'skynet', 'matrix', 'terminator'],
  MEME:     ['pepe', 'wojak', 'chad', 'based', 'degen', 'gigachad', 'bonk', 'shib', 'inu', 'floki', 'dogefather'],
  ANIMAL:   ['dog', 'doge', 'cat', 'frog', 'bear', 'bull', 'wolf', 'whale', 'ape', 'monkey', 'bird', 'fish', 'penguin', 'rabbit', 'fox', 'lion', 'tiger', 'snake', 'gorilla', 'crab', 'hamster', 'rat'],
  GAMING:   ['game', 'gaming', 'play', 'pixel', 'quest', 'guild', 'arena', 'battle', 'rpg', 'metaverse', 'minecraft', 'fortnite', 'loot', 'boss', 'hero', 'warrior'],
  DEFI:     ['defi', 'swap', 'yield', 'vault', 'stake', 'farm', 'liquid', 'protocol', 'dao', 'governance', 'treasury'],
  CELEB:    ['trump', 'elon', 'musk', 'melania', 'barron', 'biden', 'obama', 'kanye', 'taylor', 'swift', 'rihanna', 'drake'],
  SPACE:    ['moon', 'mars', 'saturn', 'astro', 'galaxy', 'cosmic', 'orbit', 'rocket', 'nasa', 'starship', 'alien', 'ufo', 'comet', 'nebula'],
  FOOD:     ['pizza', 'taco', 'burger', 'beer', 'whisky', 'coffee', 'donut', 'cookie', 'cake', 'bread', 'sushi', 'ramen', 'kebab'],
  PATRIOT:  ['usa', 'america', 'eagle', 'freedom', 'liberty', 'maga', 'giga', 'flag', 'constitution'],
  SOLANA:   ['sol', 'solana', 'jup', 'jupiter', 'raydium', 'bonk', 'saga', 'helium'],
}

export function detectNarratives(name: string, symbol: string): string[] {
  const haystack = `${name} ${symbol}`.toLowerCase()
  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(NARRATIVES)) {
    if (keywords.some(kw => haystack.includes(kw))) {
      tags.push(tag)
    }
  }
  return tags
}
