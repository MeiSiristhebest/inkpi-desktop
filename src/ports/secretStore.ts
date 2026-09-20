/** Secure credential storage boundary. Implementations must never persist secrets in browser storage. */
export interface SecretStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
