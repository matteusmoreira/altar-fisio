"use node"
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)))
}
export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString('hex')
  return { salt, passwordHash: `scrypt-v1:${(await derive(password, salt)).toString('hex')}` }
}
export async function verifyPassword(password: string, salt: string, hash: string) {
  const actual = await derive(password, salt)
  const expected = Buffer.from(hash.replace(/^scrypt-v1:/, ''), 'hex')
  return hash.startsWith('scrypt-v1:') && expected.length === actual.length && timingSafeEqual(expected, actual)
}
