/** Secure credential storage boundary. Implementations must never persist secrets in browser storage. */
export interface SecretStore {
  has(key: string): Promise<boolean>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
