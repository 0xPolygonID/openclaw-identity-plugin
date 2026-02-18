import { randomInt } from "crypto";
import {
  KMS,
  EthConnectionConfig,
  KmsKeyType,
  IdentityWallet,
  byteEncoder,
  CredentialStatusType,
  JWSPacker,
  byteDecoder,
  BasicMessage,
  hexToBytes,
  AuthorizationResponseMessage,
  PROTOCOL_CONSTANTS,
} from "@0xpolygonid/js-sdk";
import { ChallengeFileStorage } from "../storage/challenge";
import { DidEntry, DidsFileStorage } from "../storage/did";
import { DidMethod, Blockchain, NetworkId, DID } from "@iden3/js-iden3-core";
import { SigningKey, Wallet, JsonRpcProvider } from "ethers";
import { DIDResolutionResult } from "did-resolver";
import { createDidDocument } from "../utils/iden3";
import { normalizedKeyPath } from "../utils/iden3";
import { v7 as uuid } from "uuid";
import { addHexPrefix } from "../utils/ether";

interface RevocationOpts {
  type: CredentialStatusType;
  id: string;
}

interface BillionsNetworkPluginOptions {
  revocationOpts?: RevocationOpts;
}

export class BillionsNetworkPlugin {
  private _kms: KMS;
  private _identityWallet: IdentityWallet;
  private _billionsMainnetConfig: EthConnectionConfig;
  private _didsStorage: DidsFileStorage<DidEntry>;
  private _challengeStorage: ChallengeFileStorage;
  private _revocationOpts: RevocationOpts;

  constructor(
    kms: KMS,
    identityWallet: IdentityWallet,
    didsStorage: DidsFileStorage<DidEntry>,
    challengeStorage: ChallengeFileStorage,
    billionsMainnetConfig: EthConnectionConfig,
    revocationOpts?: BillionsNetworkPluginOptions,
  ) {
    this._kms = kms;
    this._identityWallet = identityWallet;
    this._didsStorage = didsStorage;
    this._challengeStorage = challengeStorage;
    this._billionsMainnetConfig = billionsMainnetConfig;
    this._revocationOpts = revocationOpts?.revocationOpts || {
      type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      id: "https://rhs-staging.polygonid.me",
    };
  }

  private async buildEthereumBasedIdentity(
    wallet: Wallet,
    seed: Uint8Array<ArrayBufferLike>,
  ): Promise<DID> {
    const { did } = await this._identityWallet.createEthereumBasedIdentity({
      method: DidMethod.Iden3,
      blockchain: Blockchain.Billions,
      networkId: NetworkId.Main,
      seed,
      revocationOpts: this._revocationOpts,
      ethSigner: wallet,
      createBjjCredential: false,
    });

    return did;
  }

  public async getIdentities(): Promise<DidEntry[]> {
    return await this._didsStorage.list();
  }

  public async getDidDocument(did: string): Promise<any> {
    const entry = did
      ? await this._didsStorage.find(did)
      : await this._didsStorage.getDefault();
    if (!entry) {
      throw new Error(`No DID ${did} found`);
    }
    const didDocument = createDidDocument(entry.did, entry.publicKeyHex);

    return { didDocument, did: entry.did };
  }

  public async generateChallenge(did: string): Promise<string> {
    const challenge = randomInt(0, 10000000000).toString();
    await this._challengeStorage.save(did, challenge);
    return challenge;
  }

  public async verifySignature(
    did: string,
    token: string,
  ): Promise<BasicMessage> {
    const challenge = await this._challengeStorage.getChallenge(did);
    if (!challenge) {
      throw new Error(`No challenge found for DID: ${did}`);
    }

    const resolveDIDDocument: {
      resolve: (did: string) => Promise<DIDResolutionResult>;
    } = {
      resolve: async () => {
        const resp = await fetch(
          `https://resolver.privado.id/1.0/identifiers/${did}`,
        );
        const didResolutionRes = (await resp.json()) as DIDResolutionResult;
        return didResolutionRes;
      },
    };

    const jws = new JWSPacker(this._kms, resolveDIDDocument);
    const basicMessage = await jws.unpack(byteEncoder.encode(token));
    if (basicMessage.from !== did) {
      throw new Error(
        `Invalid from: expected from ${did}, got ${basicMessage.from}`,
      );
    }

    const payload = basicMessage.body as { message: string };
    if (payload.message !== challenge) {
      throw new Error(
        `Invalid signature: challenge mismatch ${payload.message} !== ${challenge}`,
      );
    }

    return basicMessage;
  }

  public async signChallenge(
    challenge: string,
    inputDid: string,
  ): Promise<string> {
    const { didDocument, did } = await this.getDidDocument(inputDid);
    const resolveDIDDocument: {
      resolve: (did: string) => Promise<DIDResolutionResult>;
    } = {
      resolve: () => Promise.resolve({ didDocument } as DIDResolutionResult),
    };

    const jws = new JWSPacker(this._kms, resolveDIDDocument);
    const msgBytes = byteEncoder.encode(
      JSON.stringify(
        BillionsNetworkPlugin.getAuthResponseMessage(
          did,
          challenge,
          didDocument,
        ),
      ),
    );

    let token: Uint8Array;
    try {
      token = await jws.pack(msgBytes, {
        alg: "ES256K-R",
        issuer: did,
        did: did,
        keyType: KmsKeyType.Secp256k1,
      });
    } catch (err) {
      throw new Error(`Failed to sign challenge: ${(err as Error).message}`);
    }

    return byteDecoder.decode(token);
  }

  public async createNewEthereumIdentity(
    privateKeyHex: string,
  ): Promise<string> {
    const signer = new SigningKey(addHexPrefix(privateKeyHex));
    const keyProvider = this._kms.getKeyProvider(KmsKeyType.Secp256k1);
    if (!keyProvider) {
      throw new Error("Secp256k1 key provider not found");
    }
    const pkStorage = await keyProvider.getPkStore();
    await pkStorage.importKey({
      alias: normalizedKeyPath(KmsKeyType.Secp256k1, signer.publicKey),
      key: signer.privateKey,
    });

    const wallet = new Wallet(
      signer,
      new JsonRpcProvider(this._billionsMainnetConfig.url),
    );
    let did: DID;
    try {
      did = await this.buildEthereumBasedIdentity(
        wallet,
        hexToBytes(privateKeyHex),
      );
    } catch (err) {
      throw new Error(
        `Failed to create Ethereum-based identity: ${(err as Error).message}`,
      );
    }

    await this._didsStorage.save({
      did: did.string(),
      publicKeyHex: signer.publicKey,
      isDefault: true,
    });

    return Promise.resolve(did.string());
  }

  private static getAuthResponseMessage(
    did: string,
    challenge: string,
    didDocument: any,
  ): AuthorizationResponseMessage {
    return {
      id: uuid(),
      thid: uuid(),
      from: did,
      to: "",
      type: PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE
        .AUTHORIZATION_RESPONSE_MESSAGE_TYPE,
      body: {
        message: challenge,
        scope: [],
        did_doc: didDocument,
      },
    };
  }
}
