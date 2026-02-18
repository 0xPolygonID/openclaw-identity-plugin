import {
  KMS,
  EthConnectionConfig,
  Sec256k1Provider,
  KmsKeyType,
  IdentityWallet,
  CredentialStatusType,
  EthStateStorage,
  CredentialStorage,
  IdentityStorage,
  InMemoryMerkleTreeStorage,
  CredentialStatusResolverRegistry,
  RHSResolver,
  CredentialWallet,
  defaultEthConnectionConfig,
  BjjProvider,
  IDataStorage,
} from "@0xpolygonid/js-sdk";
import { IdentitiesFileStorage } from "./storage/identites";
import { KeysFileStorage } from "./storage/keys";

export async function newInMemoryKMS(): Promise<KMS> {
  const memoryKeyStore = new KeysFileStorage("kms.json");
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

export function newEthStateStorage(
  billionsMainnetConfig: EthConnectionConfig,
): EthStateStorage {
  return new EthStateStorage(billionsMainnetConfig);
}

export function newDataStorage(ethStateStorage: EthStateStorage) {
  return {
    credential: new CredentialStorage(
      new IdentitiesFileStorage("credentials.json"),
    ),
    identity: new IdentityStorage(
      new IdentitiesFileStorage("identities.json"),
      new IdentitiesFileStorage("profiles.json"),
    ),
    mt: new InMemoryMerkleTreeStorage(40),
    states: ethStateStorage,
  };
}

export function newCredentialWallet(
  dataStorage: IDataStorage,
): CredentialWallet {
  const resolvers = new CredentialStatusResolverRegistry();
  resolvers.register(
    CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    new RHSResolver(dataStorage.states),
  );
  return new CredentialWallet(dataStorage, resolvers);
}

export function newIdentityWallet(
  kms: KMS,
  dataStorage: IDataStorage,
  credentialWallet: CredentialWallet,
): IdentityWallet {
  return new IdentityWallet(kms, dataStorage, credentialWallet);
}

export function getBillionsMainnetConfig(): EthConnectionConfig {
  return {
    ...defaultEthConnectionConfig,
    url: "https://rpc-mainnet.billions.network",
    contractAddress: "0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896",
  };
}
