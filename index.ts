import { Type } from "@sinclair/typebox";
import { Wallet } from "ethers";
import {
  setRuntime,
  getRuntime,
  setIden3Runtime,
  getIden3Runtime,
} from "./src/runtime";

type OpenClawApi = any;

export default function (api: OpenClawApi) {
  // register runtimes
  setRuntime(api.runtime);
  setIden3Runtime();

  // 1. Register Tool (for the AI/Agent)
  // api.registerTool(
  //   {
  //     name: "eth_sign_challenge",
  //     description:
  //       "Sign a challenge string with an Ethereum private key (EIP-191 personal_sign). Returns address + signature.",
  //     parameters: Type.Object({
  //       challenge: Type.String({
  //         description:
  //           "The exact challenge string to sign (will be signed as a UTF-8 message).",
  //       }),
  //     }),
  //     async execute(_id: string, params: { challenge: string }) {
  //       // Correct way to get config in tools
  //       const cfg = api.plugin?.config;
  //       const privateKey: string | undefined = cfg?.privateKey;

  //       if (!privateKey) {
  //         return {
  //           content: [
  //             {
  //               type: "text",
  //               text: "eth-sign plugin is not configured. Check privateKey in openclaw.json.",
  //             },
  //           ],
  //         };
  //       }

  //       const wallet = new Wallet(privateKey);
  //       const signature = await wallet.signMessage(params.challenge);
  //       const result = {
  //         address: await wallet.getAddress(),
  //         signature,
  //         challenge: params.challenge,
  //       };

  //       return {
  //         content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  //       };
  //     },
  //   },
  //   { optional: true },
  // );

  // 2. Register Command (for the CLI and Slash Commands)
  // api.registerCommand({
  //   name: "sign",
  //   description: "Sign a message with the Ethereum key.",
  //   acceptsArgs: true,
  //   handler: async (ctx: any) => {
  //     try {
  //       console.log("[eth-sign] Handler triggered");

  //       // Robust message extraction
  //       let message = "";
  //       if (typeof ctx.text === "string" && ctx.text.length > 0) {
  //         message = ctx.text;
  //       } else if (typeof ctx.rest === "string" && ctx.rest.length > 0) {
  //         message = ctx.rest;
  //       } else if (Array.isArray(ctx.args)) {
  //         message = ctx.args.join(" ");
  //       } else if (ctx.args && typeof ctx.args === "string") {
  //         message = ctx.args;
  //       }

  //       console.log("[eth-sign] Final message to sign:", message);

  //       if (!message) {
  //         if (ctx.reply) return await ctx.reply("Usage: /sign <message>");
  //         throw new Error("Missing message to sign.");
  //       }

  //       // Correct way to get config as per OpenClaw docs
  //       const cfg = api.runtime.config.loadConfig();
  //       console.log(cfg);
  //       const privateKey = (
  //         cfg?.plugins?.entries?.["eth-sign"]?.config?.privateKey ?? ""
  //       ).trim();

  //       if (!privateKey) {
  //         throw new Error("Missing privateKey in plugin configuration.");
  //       }

  //       const wallet = new Wallet(privateKey);
  //       const signature = await wallet.signMessage(message);
  //       const address = await wallet.getAddress();

  //       const result = { address, signature, message };
  //       const output = JSON.stringify(result, null, 2);

  //       return { text: output };

  //       console.log("[eth-sign] Result generated");

  //       if (ctx.reply) {
  //         await ctx.reply(`\`\`\`json\n${output}\n\`\`\``);
  //       } else {
  //         console.log(output);
  //       }
  //     } catch (err: any) {
  //       console.error("[eth-sign] Fatal error in handler:", err);
  //       if (ctx.reply) {
  //         try {
  //           await ctx.reply(`Error: ${err.message}`);
  //         } catch (replyErr) {
  //           console.error("[eth-sign] Failed to send error reply:", replyErr);
  //         }
  //       }
  //     }
  //   },
  // });

  api.registerCli(
    ({ program }) => {
      const iden3Commands = program
        .command("iden3")
        .description("Manage Iden3 identities");
      const keysCommands = iden3Commands
        .command("key")
        .description("Manage Iden3 keys");

      keysCommands
        .command("add")
        .description("Add a new key to an identity")
        .requiredOption(
          "-k, --key <key>",
          "Hex string of the private key to add",
        )
        .option(
          "-s, --seed <seed>",
          "Optional seed for deterministic identity generation",
        )
        .action(async (options: { key: string; seed?: string }) => {
          const did = await getIden3Runtime().createNewIdentity(
            options.key,
            options.seed,
          );
          console.log(`New identity created: ${did}`);
        });
    },
    { commands: ["mycmd"] },
  );
}
