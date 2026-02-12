import type { PluginRuntime } from "openclaw/plugin-sdk";
import {
  KMS,
  EthConnectionConfig,
  InMemoryPrivateKeyStore,
  Sec256k1Provider,
  KmsKeyType,
  IdentityWallet,
  byteEncoder,
  CredentialStatusType,
  EthStateStorage,
  InMemoryDataSource,
  CredentialStorage,
  IdentityStorage,
  InMemoryMerkleTreeStorage,
  CredentialStatusResolverRegistry,
  RHSResolver,
  CredentialWallet,
  IIdentityStorage,
  defaultEthConnectionConfig,
  BjjProvider,
} from "@0xpolygonid/js-sdk";
import { DidMethod, Blockchain, NetworkId, DID } from "@iden3/js-iden3-core";
import { SigningKey, Wallet, JsonRpcProvider } from "ethers";

let runtime: PluginRuntime | null = null;
let iden3Runtime: Iden3PluginRuntime | null = null;

export function setRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("runtime not initialized");
  }
  return runtime;
}

export async function setIden3Runtime(): Promise<void> {
  const billionsMainnetConfig: EthConnectionConfig = {
    ...defaultEthConnectionConfig,
    url: "https://rpc-mainnet.billions.network",
    contractAddress: "0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896",
  };

  const kms = await initializeInMemoryKMS();
  const stateStorage = initializeEthStateStorage(billionsMainnetConfig);
  const dataStorage = initializeDataStorage(stateStorage);
  const credentialWallet = initializeCredentialWallet(dataStorage);
  const identityWallet = initializeIdentityWallet(
    kms,
    dataStorage,
    credentialWallet,
  );

  const runtime = new Iden3PluginRuntime(
    kms,
    stateStorage,
    credentialWallet,
    identityWallet,
    dataStorage.identity,
    billionsMainnetConfig,
  );

  iden3Runtime = runtime;
}

export function getIden3Runtime(): Iden3PluginRuntime {
  if (!iden3Runtime) {
    throw new Error("Iden3 plugin runtime not initialized");
  }
  return iden3Runtime;
}

export async function initializeInMemoryKMS(): Promise<KMS> {
  const memoryKeyStore = new InMemoryPrivateKeyStore();
  const secpProvider = new Sec256k1Provider(
    KmsKeyType.Secp256k1,
    memoryKeyStore,
  );
  const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
  const kms = new KMS();
  kms.registerKeyProvider(KmsKeyType.Secp256k1, secpProvider);
  kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);
  return kms;
}

function keyPath(keyType: KmsKeyType, keyID: string): string {
  const basePath = "";
  return basePath + String(keyType) + ":" + keyID;
}

export function initializeEthStateStorage(
  billionsMainnetConfig: EthConnectionConfig,
): EthStateStorage {
  return new EthStateStorage(billionsMainnetConfig);
}

export function initializeDataStorage(ethStateStorage: EthStateStorage) {
  return {
    credential: new CredentialStorage(new InMemoryDataSource()),
    identity: new IdentityStorage(
      new InMemoryDataSource(),
      new InMemoryDataSource(),
    ),
    mt: new InMemoryMerkleTreeStorage(40),
    states: ethStateStorage,
  };
}

export function initializeCredentialWallet(
  dataStorage: ReturnType<typeof initializeDataStorage>,
): CredentialWallet {
  const resolvers = new CredentialStatusResolverRegistry();
  resolvers.register(
    CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    new RHSResolver(dataStorage.states),
  );
  return new CredentialWallet(dataStorage, resolvers);
}

export function initializeIdentityWallet(
  kms: KMS,
  dataStorage: ReturnType<typeof initializeDataStorage>,
  credentialWallet: CredentialWallet,
): IdentityWallet {
  return new IdentityWallet(kms, dataStorage, credentialWallet);
}

class Iden3PluginRuntime {
  private _kms: KMS;
  private _stateStorage: EthStateStorage;
  private _credentialWallet: CredentialWallet;
  private _identityWallet: IdentityWallet;
  private _billionsMainnetConfig: EthConnectionConfig;

  // TODO (illia-korotia): refactor it
  private _identityStorage: IIdentityStorage;

  constructor(
    kms: KMS,
    stateStorage: EthStateStorage,
    credentialWallet: CredentialWallet,
    identityWallet: IdentityWallet,
    identityStorage: IIdentityStorage,
    billionsMainnetConfig: EthConnectionConfig,
  ) {
    this._kms = kms;
    this._stateStorage = stateStorage;
    this._credentialWallet = credentialWallet;
    this._identityWallet = identityWallet;
    this._identityStorage = identityStorage;
    this._billionsMainnetConfig = billionsMainnetConfig;
  }

  private async buildEthereumBaseIdentity(
    wallet: Wallet,
    seed: string = "",
  ): Promise<DID> {
    const { did, credential } =
      await this._identityWallet.createEthereumBasedIdentity({
        method: DidMethod.Iden3,
        blockchain: Blockchain.Billions,
        networkId: NetworkId.Main,
        seed: byteEncoder.encode(seed),
        revocationOpts: {
          type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
          id: "https://rhs-staging.polygonid.me",
        },
        ethSigner: wallet,
        createBjjCredential: false,
      });

    return did;
  }

  public async getIdentities(): Promise<Array<string>> {
    const idents = await this._identityStorage.getAllIdentities();
    return idents.map((ident) => ident.did);
  }

  public async createNewIdentity(
    privateKeyHex: string,
    seed: string = "0x0000000000000000000000000000000000000000000000000000000000000001",
  ): Promise<string> {
    const signer = new SigningKey(privateKeyHex);
    const keyProvider = this._kms.getKeyProvider(KmsKeyType.Secp256k1);
    if (!keyProvider) {
      throw new Error("Secp256k1 key provider not found");
    }
    const pkStorage = await keyProvider.getPkStore();
    await pkStorage.importKey({
      alias: keyPath(KmsKeyType.Secp256k1, signer.publicKey.slice(2)), // Remove '0x' prefix
      key: signer.privateKey,
    });

    const wallet = new Wallet(
      privateKeyHex,
      new JsonRpcProvider(this._billionsMainnetConfig.url),
    );
    const did = await this.buildEthereumBaseIdentity(wallet, seed);
    return Promise.resolve(did.string());
  }
}
