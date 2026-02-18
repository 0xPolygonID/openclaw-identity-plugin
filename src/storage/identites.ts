import { IDataSource } from "@0xpolygonid/js-sdk";
import { FileStorage } from "./base";

export class IdentitiesFileStorage<Type>
  extends FileStorage<Type>
  implements IDataSource<Type>
{
  async load(): Promise<Type[]> {
    return await this.readFile();
  }

  async save(key: string, value: Type, keyName: string = "id"): Promise<void> {
    const data = await this.readFile();
    const index = data.findIndex((item: any) => item[keyName] === key);

    if (index >= 0) {
      // Update existing item
      data[index] = value;
    } else {
      // Add new item
      data.push(value);
    }

    await this.writeFile(data);
  }

  async get(key: string, keyName: string = "id"): Promise<Type | undefined> {
    const data = await this.readFile();
    return data.find((item: any) => item[keyName] === key);
  }

  async delete(key: string, keyName: string = "id"): Promise<void> {
    const data = await this.readFile();
    const filtered = data.filter((item: any) => item[keyName] !== key);

    if (filtered.length === data.length) {
      // Item not found, throw error to match expected behavior
      throw new Error(`Item with ${keyName}=${key} not found`);
    }

    await this.writeFile(filtered);
  }
}
