import { AbstractPrivateKeyStore } from "@0xpolygonid/js-sdk";
import { FileStorage } from "./base";

/**
 * Structure for storing key pairs indexed by DID
 */
export interface KeyEntry {
  alias: string;
  privateKeyHex: string;
}

/**
 * File-based storage for cryptographic keys indexed by DID.
 * Implements AbstractPrivateKeyStore interface from js-sdk.
 * Stores keys in JSON format as an array of {did: keyHex} objects.
 *
 * @implements {AbstractPrivateKeyStore}
 */
export class KeysFileStorage
  extends FileStorage<KeyEntry>
  implements AbstractPrivateKeyStore
{
  /**
   * Creates a new KeyStorage instance.
   * @param filename - Name of the JSON file to store keys (default: 'keys.json')
   */
  constructor(filename: string = "keys.json") {
    super(filename);
  }

  async importKey(args: { alias: string; key: string }): Promise<void> {
    const keys = await this.readFile();
    const index = keys.findIndex((entry) => entry.alias === args.alias);

    if (index >= 0) {
      keys[index].privateKeyHex = args.key;
    } else {
      keys.push({ alias: args.alias, privateKeyHex: args.key });
    }

    await this.writeFile(keys);
  }

  async get(args: { alias: string }): Promise<string> {
    const keys = await this.readFile();
    const entry = keys.find((entry) => entry.alias === args.alias);
    return entry ? entry.privateKeyHex : "";
  }

  async list(): Promise<{ alias: string; key: string }[]> {
    const keys = await this.readFile();
    return keys.map((entry) => ({
      alias: entry.alias,
      key: entry.privateKeyHex,
    }));
  }
}
