import * as fs from "fs/promises";
import * as path from "path";

export abstract class FileStorage<T> {
  protected filePath: string;

  constructor(
    filename: string,
    baseDir: string = `${process.env.HOME}/.openclaw/workspace/billions`,
  ) {
    this.filePath = path.join(baseDir, filename);
  }

  protected async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  protected async readFile(): Promise<T[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  protected async writeFile(data: T[]): Promise<void> {
    await this.ensureDirectory();
    const json = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, json, "utf-8");
    await fs.rename(tempPath, this.filePath);
  }
}
