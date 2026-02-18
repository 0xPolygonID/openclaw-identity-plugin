// @ts-ignore
import type { PluginRuntime } from "openclaw/plugin-sdk";
import { ChallengeFileStorage } from "./storage/challenge";
import { DidEntry, DidsFileStorage } from "./storage/did";
import { BillionsNetworkPlugin } from "./plugin/plugin";
import {
  newInMemoryKMS,
  newEthStateStorage,
  newDataStorage,
  newCredentialWallet,
  newIdentityWallet,
  getBillionsMainnetConfig,
} from "./initialization";

let runtime: PluginRuntime | null = null;
let billionsNetworkPlugin: BillionsNetworkPlugin | null = null;

export function setRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("runtime not initialized");
  }
  return runtime;
}

export async function setBillionsNetworkPlugin(): Promise<void> {
  const billionsMainnetConfig = getBillionsMainnetConfig();

  const kms = await newInMemoryKMS();
  const stateStorage = newEthStateStorage(billionsMainnetConfig);
  const dataStorage = newDataStorage(stateStorage);
  const credentialWallet = newCredentialWallet(dataStorage);
  const identityWallet = newIdentityWallet(kms, dataStorage, credentialWallet);

  const runtime = new BillionsNetworkPlugin(
    kms,
    identityWallet,
    new DidsFileStorage<DidEntry>("defaultDid.json"),
    new ChallengeFileStorage("challenges.json"),
    billionsMainnetConfig,
  );

  billionsNetworkPlugin = runtime;
}

export function getBillionsNetworkRuntime(): BillionsNetworkPlugin {
  if (!billionsNetworkPlugin) {
    throw new Error("BillionsNetwork plugin runtime not initialized");
  }
  return billionsNetworkPlugin;
}
