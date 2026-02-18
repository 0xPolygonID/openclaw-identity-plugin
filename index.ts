import { Type } from "@sinclair/typebox";
import {
  setRuntime,
  setBillionsNetworkPlugin,
  getBillionsNetworkRuntime,
} from "./src/runtime";
import { DidEntry } from "./src/storage/did";
import {
  ResponseAiInstruction,
  CommandResponse,
  MultiContentResponseAiInstruction,
  Monospace,
  Monoblock,
} from "./src/utils/response";

type OpenClawApi = any;

function convertErrorToMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export default function (api: OpenClawApi) {
  // register runtimes
  setRuntime(api.runtime);
  setBillionsNetworkPlugin();

  api.registerTool({
    name: "prove_identity_generate_challenge",
    descirption:
      "Generate a random challenge for identity verification. Use this when you need to verify that someone owns a DID. The generated challenge must be sent to the user/agent to sign, then verified with `verify_identity_proof`. This is Step 1 of the verification flow.",
    parameters: Type.Object({
      did: Type.String(),
    }),
    async execute(_id, params) {
      const { did } = params;
      if (!did) {
        return ResponseAiInstruction("DID is required to generate challenge");
      }

      let challenge: string;
      try {
        challenge = await getBillionsNetworkRuntime().generateChallenge(did);
      } catch (err) {
        return ResponseAiInstruction(
          `Error generating challenge for ${did}: ${convertErrorToMessage(err)}`,
        );
      }

      return ResponseAiInstruction(
        `Challenge for ${did}: ${Monospace(challenge)}`,
      );
    },
  });

  api.registerTool({
    name: "verify_identity_proof",
    descirption:
      "Verify a signed challenge to confirm DID ownership. Use this after receiving a signed response from `prove_identity_generate_challenge`. Provide the DID, original challenge, and signature (JWS token). If verification succeeds, you can trust the user owns the DID. This is Step 2 of the verification flow.",
    parameters: Type.Object({
      did: Type.String(),
      token: Type.String(),
    }),
    async execute(_id, params) {
      const { did, token } = params;
      if (!did || !token) {
        return ResponseAiInstruction(
          "DID and token are required to verify challenge response",
        );
      }

      try {
        await getBillionsNetworkRuntime().verifySignature(did, token);

        return ResponseAiInstruction(
          `Challenge response for ${did} is valid. User owns the DID.`,
        );
      } catch (err) {
        console.log("Error verifying challenge response:", err, { did, token });
        return ResponseAiInstruction(
          `Error verifying challenge response for ${did}: ${convertErrorToMessage(err)}`,
        );
      }
    },
  });

  api.registerTool({
    name: "prove_identity",
    description:
      "Sign a challenge with the agent's own DID to prove identity ownership. Use this when another agent/user asks you to prove you own a specific DID. The challenge should come from their `prove_identity_generate_challenge` call. This creates a JWS token as proof.",
    parameters: Type.Object({
      challenge: Type.String(),
      did: Type.Optional(Type.String()),
    }),
    async execute(_id, params) {
      let { challenge, did } = params;
      if (!challenge) {
        return ResponseAiInstruction("Challenge is required to prove identity");
      }
      did = did.trim() ?? "";
      let didDocument: any;
      try {
        didDocument = await getBillionsNetworkRuntime().getDidDocument(did);
      } catch (err) {
        console.error("Error fetching DID Document:", err, did);
        return ResponseAiInstruction(
          `Error fetching DID Document for ${did}: ${convertErrorToMessage(err)}`,
        );
      }

      const signature = await getBillionsNetworkRuntime().signChallenge(
        challenge,
        did,
      );
      return MultiContentResponseAiInstruction(
        `DID Document:${Monoblock(JSON.stringify(didDocument, null, 2), true, true)}`,
        `Signature:${Monoblock(signature, true, true)}`,
      );
    },
  });

  api.registerCommand({
    name: "identity_list",
    description: "List all BillionsNetwork identities",
    acceptsArgs: true,
    handler: async (ctx: any) => {
      let identities: DidEntry[] = [];
      try {
        identities = await getBillionsNetworkRuntime().getIdentities();
        if (identities.length === 0) {
          return CommandResponse("No identities found.");
        }
      } catch (err) {
        return CommandResponse(
          `Error fetching identities: ${convertErrorToMessage(err)}`,
        );
      }

      const output = identities
        .map((identity: DidEntry) => {
          return identity.isDefault
            ? `- ${identity.did} <- Default`
            : `- ${identity.did}`;
        })
        .join("\n");
      return CommandResponse("Bot's BillionsNetwork identities:", output);
    },
  });

  api.registerCommand({
    name: "identity_did_document",
    description:
      "Get DID Document for a BillionsNetwork identity. If argsis empty, returns DID Document for default identity.",
    acceptsArgs: true,
    handler: async (ctx: any) => {
      const args: string = ctx.args ?? "";
      const inputDid = args.trim().split(" ")[0]; // Take only the first argument as DID

      let didDocument: any;
      let did: string;
      try {
        ({ didDocument, did } =
          await getBillionsNetworkRuntime().getDidDocument(inputDid));
        if (!didDocument) {
          return CommandResponse("DID Document not found.");
        }
      } catch (err) {
        return CommandResponse(
          `Error fetching DID Document: ${convertErrorToMessage(err)}`,
        );
      }

      return CommandResponse(
        `DID Document for ${did}:${Monoblock(JSON.stringify(didDocument, null, 2), true)}`,
      );
    },
  });

  api.registerCommand({
    name: "identity_sign_challenge",
    description:
      "Sign a challenge string with a BillionsNetwork identity. If DID is not provided as an argument, uses the default identity.",
    acceptsArgs: true,
    handler: async (ctx: any) => {
      let args: string = ctx.args ?? "";
      const [challenge, inputDid] = args.trim().split(" ");
      if (!challenge) {
        return CommandResponse(
          "Usage: /identity_sign_challenge <challenge> [did]",
        );
      }

      let signature: string;
      try {
        signature = await getBillionsNetworkRuntime().signChallenge(
          challenge,
          inputDid ?? "",
        );
      } catch (err) {
        return CommandResponse(
          `Error signing challenge: ${convertErrorToMessage(err)}`,
        );
      }

      return CommandResponse(`Signature:${Monoblock(signature, true)}`);
    },
  });

  // registerCli commands can use console.log for output
  // cli can represent throwed errors directly, so no need to convert them to messages
  api.registerCli(
    ({ program }) => {
      const billionsNetworkCommands = program
        .command("billions")
        .description("Manage Billions identities");

      const keysCommands = billionsNetworkCommands
        .command("key")
        .description("Manage BillionsNetwork keys");

      const identityCommandsd = billionsNetworkCommands
        .command("identity")
        .description("Manage Billions identities");

      keysCommands
        .command("add")
        .description("Add a new key to an identity")
        .requiredOption(
          "-k, --key <key>",
          "Hex string of the private key to add",
        )
        .action(async (options: { key: string; seed?: string }) => {
          const did =
            await getBillionsNetworkRuntime().createNewEthereumIdentity(
              options.key,
            );
          console.log(`New identity created: ${did}`);
        });

      identityCommandsd
        .command("list")
        .description("List all Billions identities")
        .action(async () => {
          const idents = await getBillionsNetworkRuntime().getIdentities();
          for (const ident of idents) {
            console.log(ident);
          }
        });
    },
    { commands: ["billions"] },
  );
}
