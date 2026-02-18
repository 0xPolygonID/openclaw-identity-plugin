import { IDataSource } from "@0xpolygonid/js-sdk";
import { FileStorage } from "./base";

export interface DidEntry {
  did: string;
  publicKeyHex: string;
  isDefault: boolean;
}

// DidsFileStorage manages defaitl DID
export class DidsFileStorage<Type extends DidEntry> extends FileStorage<Type> {
  async save({
    did,
    publicKeyHex,
    isDefault = false,
  }: {
    did: string;
    publicKeyHex: string;
    isDefault?: boolean;
  }): Promise<void> {
    const entries = await this.readFile();

    // If setting this as default, unset all other defaults
    if (isDefault) {
      entries.forEach((entry) => {
        entry.isDefault = false;
      });
    }

    const index = entries.findIndex((entry) => entry.did === did);

    if (index >= 0) {
      entries[index] = { did, publicKeyHex, isDefault } as Type;
    } else {
      entries.push({ did, publicKeyHex, isDefault } as Type);
    }

    await this.writeFile(entries);
  }

  async find(did: string): Promise<Type | undefined> {
    const entries = await this.readFile();
    return entries.find((entry) => entry.did === did);
  }

  async getDefault(): Promise<Type | undefined> {
    const entries = await this.readFile();
    return entries.find((entry) => entry.isDefault);
  }

  async list(): Promise<Type[]> {
    return this.readFile();
  }
}
