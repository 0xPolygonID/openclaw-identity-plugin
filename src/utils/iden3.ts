import { bytesToHex, keyPath, KmsKeyType } from "@0xpolygonid/js-sdk";
import { normalizeKey } from "./ether";
import { DID, Id } from "@iden3/js-iden3-core";

export function createDidDocument(did: string, publicKeyHex: string) {
  const ethereumAddress = Id.ethAddressFromId(DID.idFromDID(DID.parse(did)));
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/secp256k1recovery-2020/v2",
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#ethereum-based-id`,
        controller: did,
        type: "EcdsaSecp256k1RecoveryMethod2020",
        ethereumAddress: `0x${bytesToHex(ethereumAddress)}`,
        publicKeyHex: publicKeyHex,
      },
    ],
    authentication: [`${did}#ethereum-based-id`],
  };
}

export function normalizedKeyPath(keyType: KmsKeyType, keyID: string): string {
  return keyPath(keyType, normalizeKey(keyID));
}
