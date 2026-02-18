import { FileStorage } from "./base";

export interface ChallengeEntry {
  did: string;
  challenge: string;
  created_at: Date;
}

export class ChallengeFileStorage extends FileStorage<ChallengeEntry> {
  constructor(filename: string = "challenges.json") {
    super(filename);
  }

  async save(did: string, challenge: string): Promise<void> {
    const entries = await this.readFile();
    const created_at = new Date();

    const index = entries.findIndex((entry) => entry.did === did);

    if (index >= 0) {
      // Update existing entry
      entries[index] = { did, challenge, created_at };
    } else {
      // Add new entry
      entries.push({ did, challenge, created_at });
    }

    await this.writeFile(entries);
  }

  async find(did: string): Promise<ChallengeEntry | undefined> {
    const entries = await this.readFile();
    return entries.find((entry) => entry.did === did);
  }

  async getChallenge(did: string): Promise<string | undefined> {
    const entry = await this.find(did);
    return entry?.challenge;
  }

  async list(): Promise<ChallengeEntry[]> {
    return this.readFile();
  }

  async delete(did: string): Promise<boolean> {
    const entries = await this.readFile();
    const initialLength = entries.length;
    const filtered = entries.filter((entry) => entry.did !== did);

    if (filtered.length < initialLength) {
      await this.writeFile(filtered);
      return true;
    }

    return false;
  }
}
