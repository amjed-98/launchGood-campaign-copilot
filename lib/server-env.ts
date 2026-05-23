export function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim();
}
