import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillionsNetworkPlugin } from "../../src/plugin/plugin";
import {
  KMS,
  KmsKeyType,
  InMemoryPrivateKeyStore,
  Sec256k1Provider,
  IdentityWallet,
  defaultEthConnectionConfig,
  ICredentialWallet,
  IDataStorage,
} from "@0xpolygonid/js-sdk";
import { SigningKey } from "ethers";
import { DidsFileStorage, DidEntry } from "../../src/storage/did";
import { ChallengeFileStorage } from "../../src/storage/challenge";
import { normalizedKeyPath } from "../../src/utils/iden3";

// Test data
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;
const TEST_CHALLENGE = "6247581133";
const TEST_DID =
  "did:iden3:billions:main:2VmAkXrihYaLeGrCp1znvFJuu74x7Tob6C5xfU3bDB";

describe("BillionsNetworkPlugin.signChallenge", () => {
  let plugin: BillionsNetworkPlugin;
  let kms: KMS;
  let testDidEntry: DidEntry;
  let testDid: string;

  // Mock storage instances
  let mockDidsStorage: any;
  let mockChallengeStorage: any;
  let mockIdentityWallet: any;

  beforeEach(async () => {
    // Derive public key from private key
    const signer = new SigningKey(`0x${TEST_PRIVATE_KEY}`);
    const publicKeyHex = signer.publicKey;

    // Setup test DID entry
    testDidEntry = {
      did: TEST_DID,
      publicKeyHex: publicKeyHex,
      isDefault: true,
    };

    // Initialize real KMS with in-memory key store
    const privateKeyStore = new InMemoryPrivateKeyStore();
    await privateKeyStore.importKey({
      alias: normalizedKeyPath(KmsKeyType.Secp256k1, publicKeyHex),
      key: signer.privateKey,
    });

    kms = new KMS();
    const secpProvider = new Sec256k1Provider(
      KmsKeyType.Secp256k1,
      privateKeyStore,
    );
    kms.registerKeyProvider(KmsKeyType.Secp256k1, secpProvider);

    // Create mock storage instances
    mockDidsStorage = {
      find: vi.fn().mockResolvedValue(testDidEntry),
      getDefault: vi.fn().mockResolvedValue(testDidEntry),
      save: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([testDidEntry]),
    } as any;

    mockChallengeStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      getChallenge: vi.fn().mockResolvedValue(TEST_CHALLENGE),
    } as any;

    // Create minimal mock for identity wallet
    mockIdentityWallet = {} as IdentityWallet;

    // Create plugin instance with mocked dependencies
    plugin = new BillionsNetworkPlugin(
      kms,
      mockIdentityWallet,
      mockDidsStorage as DidsFileStorage<DidEntry>,
      mockChallengeStorage as ChallengeFileStorage,
      {
        ...defaultEthConnectionConfig,
        url: "https://rpc-mainnet.billions.network",
        contractAddress: "0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896",
        chainId: 45056,
      },
    );
  });

  it("should successfully sign challenge with valid DID and private key", async () => {
    // Act: Sign the challenge
    const token = await plugin.signChallenge(TEST_CHALLENGE, TEST_DID);
    console.log("Generated token:", token);
    console.log(
      "Did document:",
      JSON.stringify(await plugin.getDidDocument(TEST_DID)),
    );

    // Assert: Token should be returned as a non-empty string
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // Verify storage interaction
    expect(mockDidsStorage.find).toHaveBeenCalledWith(TEST_DID);
  });
});

describe("BillionsNetworkPlugin.verifySignature", () => {
  let plugin: BillionsNetworkPlugin;
  let kms: KMS;

  // Mock storage instances
  let mockDidsStorage: any;
  let mockChallengeStorage: any;
  let mockIdentityWallet: any;

  // Test data for verification
  const TEST_CHALLENGE = "749151";
  const TEST_TOKEN =
    "eyJhbGciOiJFUzI1NkstUiIsImtpZCI6ImRpZDppZGVuMzpiaWxsaW9uczptYWluOjJWbUFrWHJpaFlhTGVHckNwMXpudkZKdXU3NHg3VG9iNkM1eGZVM2JEQiNldGhlcmV1bS1iYXNlZC1pZCIsInR5cCI6ImFwcGxpY2F0aW9uL2lkZW4zY29tbS1zaWduZWQtanNvbiJ9.eyJpZCI6IjAxOWM3MTE2LTVhODgtNzAxMC1iODkzLTJhZTYwZTNhNmU3MSIsInRoaWQiOiIwMTljNzExNi01YTg5LTc3YWUtYmU3My01MTgxOWRmNGU4MWEiLCJmcm9tIjoiZGlkOmlkZW4zOmJpbGxpb25zOm1haW46MlZtQWtYcmloWWFMZUdyQ3Axem52Rkp1dTc0eDdUb2I2QzV4ZlUzYkRCIiwidG8iOiIiLCJ0eXBlIjoiaHR0cHM6Ly9pZGVuMy1jb21tdW5pY2F0aW9uLmlvL2F1dGhvcml6YXRpb24vMS4wL3Jlc3BvbnNlIiwiYm9keSI6eyJtZXNzYWdlIjoiNzQ5MTUxIiwic2NvcGUiOltdLCJkaWRfZG9jIjp7IkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy9ucy9kaWQvdjEiLCJodHRwczovL3czaWQub3JnL3NlY3VyaXR5L3N1aXRlcy9zZWNwMjU2azFyZWNvdmVyeS0yMDIwL3YyIl0sImlkIjoiZGlkOmlkZW4zOmJpbGxpb25zOm1haW46MlZtQWtYcmloWWFMZUdyQ3Axem52Rkp1dTc0eDdUb2I2QzV4ZlUzYkRCIiwidmVyaWZpY2F0aW9uTWV0aG9kIjpbeyJpZCI6ImRpZDppZGVuMzpiaWxsaW9uczptYWluOjJWbUFrWHJpaFlhTGVHckNwMXpudkZKdXU3NHg3VG9iNkM1eGZVM2JEQiNldGhlcmV1bS1iYXNlZC1pZCIsImNvbnRyb2xsZXIiOiJkaWQ6aWRlbjM6YmlsbGlvbnM6bWFpbjoyVm1Ba1hyaWhZYUxlR3JDcDF6bnZGSnV1NzR4N1RvYjZDNXhmVTNiREIiLCJ0eXBlIjoiRWNkc2FTZWNwMjU2azFSZWNvdmVyeU1ldGhvZDIwMjAiLCJldGhlcmV1bUFkZHJlc3MiOiIweDg5NWQxZmNhZDE3Mzc0NjIwNzVmZjdjYmQ3YmQxZTE3NzA3YTZlY2YiLCJwdWJsaWNLZXlIZXgiOiIweDA0YWU3MWY4MmIwMTQ5MTQ2NGY5N2E2ZWU0OTRkZTQ1OTZkNTJkODA2ZGExYmVlNDJjMGUyMjJiMGM5MmVmYjQyZjgxMDlmNTY5NmIzMmM5YjExYjIzYWE4MmY5NGRlNzllOWQ5MDRiMDdjZWE0Yjk3MmM4MzcwODcwYzc0MDlkZDEifV0sImF1dGhlbnRpY2F0aW9uIjpbImRpZDppZGVuMzpiaWxsaW9uczptYWluOjJWbUFrWHJpaFlhTGVHckNwMXpudkZKdXU3NHg3VG9iNkM1eGZVM2JEQiNldGhlcmV1bS1iYXNlZC1pZCJdfX19.PAHDK4vSH8v4OFQf4LyoI3hQ0P290TAsCUOM0ZJqJ0pCQM_143ZgydlZDP3I24s3-tAtWMcb_8gMpGYbUGzz1gE";

  beforeEach(async () => {
    // Initialize real KMS (required for JWS verification)
    const privateKeyStore = new InMemoryPrivateKeyStore();
    kms = new KMS();
    const secpProvider = new Sec256k1Provider(
      KmsKeyType.Secp256k1,
      privateKeyStore,
    );
    kms.registerKeyProvider(KmsKeyType.Secp256k1, secpProvider);

    // Create mock storage instances
    mockDidsStorage = {
      find: vi.fn(),
      getDefault: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    } as any;

    mockChallengeStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      getChallenge: vi.fn().mockResolvedValue(TEST_CHALLENGE),
    } as any;

    // Create minimal mock for identity wallet
    mockIdentityWallet = {} as IdentityWallet;

    // Create plugin instance with mocked dependencies
    plugin = new BillionsNetworkPlugin(
      kms,
      mockIdentityWallet,
      mockDidsStorage as DidsFileStorage<DidEntry>,
      mockChallengeStorage as ChallengeFileStorage,
      {
        ...defaultEthConnectionConfig,
        url: "https://rpc-mainnet.billions.network",
        contractAddress: "0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896",
        chainId: 45056,
      },
    );
  });

  it("should successfully verify a valid signature", async () => {
    await plugin.verifySignature(TEST_DID, TEST_TOKEN);
  });
});

describe("BillionsNetworkPlugin.createNewIdentity", () => {
  let plugin: BillionsNetworkPlugin;
  let kms: KMS;
  let mockIdentityWallet: any;
  let mockDidsStorage: any;
  let mockChallengeStorage: any;

  beforeEach(async () => {
    // Initialize real KMS with in-memory key store
    const privateKeyStore = new InMemoryPrivateKeyStore();
    kms = new KMS();
    const secpProvider = new Sec256k1Provider(
      KmsKeyType.Secp256k1,
      privateKeyStore,
    );
    kms.registerKeyProvider(KmsKeyType.Secp256k1, secpProvider);

    // Mock IDataStorage with required methods for identity creation
    const mockIDataStorage = {
      credential: {}, // Not used when createBjjCredential: false
      identity: {
        saveIdentity: vi.fn().mockResolvedValue(undefined),
        getIdentity: vi.fn().mockResolvedValue(undefined),
        getAllIdentities: vi.fn().mockResolvedValue([]),
        saveProfile: vi.fn().mockResolvedValue(undefined),
        getProfileById: vi.fn().mockResolvedValue(undefined),
        getProfilesByGenesisIdentifier: vi.fn().mockResolvedValue([]),
      },
      mt: {
        createIdentityMerkleTrees: vi.fn().mockResolvedValue([]),
        addToMerkleTree: vi.fn().mockResolvedValue(undefined),
        getMerkleTreeByIdentifierAndType: vi.fn().mockResolvedValue(null),
        bindMerkleTreeToNewIdentifier: vi.fn().mockResolvedValue(undefined),
      },
      states: {
        getRpcProvider: vi.fn().mockReturnValue(null),
      },
    } as unknown as IDataStorage;

    // Mock ICredentialWallet (minimal since createBjjCredential: false)
    const mockICredentialWallet = {} as ICredentialWallet;

    // Create REAL IdentityWallet with mocked dependencies
    mockIdentityWallet = new IdentityWallet(
      kms,
      mockIDataStorage,
      mockICredentialWallet,
    );

    // Create mock storage instances
    mockDidsStorage = {
      find: vi.fn(),
      getDefault: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    } as any;

    mockChallengeStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      getChallenge: vi.fn(),
    } as any;

    // Create plugin instance
    plugin = new BillionsNetworkPlugin(
      kms,
      mockIdentityWallet,
      mockDidsStorage as DidsFileStorage<DidEntry>,
      mockChallengeStorage as ChallengeFileStorage,
      {
        ...defaultEthConnectionConfig,
        url: "https://rpc-mainnet.billions.network",
        contractAddress: "0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896",
        chainId: 45056,
      },
    );
  });

  it("should create new identity with TEST_PRIVATE_KEY", async () => {
    const privateKeyWithPrefix = `0x${TEST_PRIVATE_KEY}`;
    const did = await plugin.createNewEthereumIdentity(privateKeyWithPrefix);
    console.log("Created DID:", did);
  });
});
