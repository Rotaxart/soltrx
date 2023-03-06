"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWsol = exports.getTokenAccountsByOwner = void 0;
const web3 = __importStar(require("@solana/web3.js"));
const bs58_1 = __importDefault(require("bs58"));
const splToken = __importStar(require("@solana/spl-token"));
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const spl_token_1 = require("@solana/spl-token");
const RAY_SOL_LP_V4_POOL_KEY = "89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip";
const RAYDIUM_LIQUIDITY_JSON = "https://api.raydium.io/v2/sdk/liquidity/mainnet.json";
const privateKey = "2wD69Zzun6MKSfF6czG6Z5axQYd61RUVHLdxYXMZgwRnVtaoKfMuCGMiSEgt8czJrCScrwSHVTXfn1tXGJF9wNas";
const publicKey = new web3.PublicKey("ABmR5nuWyyMsxdzpKzc1kyhBwL8UBwk2CgTB42oHLCTh");
const publicKey2 = new web3.PublicKey("BpU1rNZu55z7ZJ3PdHjYkDZTtZsAK3rMEy8nNduJeczA");
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"));
async function sendSol(amt, recieverAddress, privateKey) {
    try {
        const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        const transaction = new web3.Transaction().add(web3.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new web3.PublicKey(recieverAddress),
            lamports: web3.LAMPORTS_PER_SOL * amt,
        }));
        const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
            keypair,
        ]);
        return tx;
    }
    catch (error) {
        console.error(error);
    }
}
// sendSol(0.1, publicKey2, privateKey)
async function sendSplToken(amt, recieverAddress, privateKey, tokenAddress) {
    try {
        const tokenPubKey = new web3.PublicKey(tokenAddress);
        const mint = new web3.PublicKey(tokenAddress);
        const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
        const recieverPubKey = new web3.PublicKey(recieverAddress);
        const { TOKEN_PROGRAM_ID } = splToken;
        const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, mint, keypair.publicKey);
        const associatedDestinationTokenAddr = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, tokenPubKey, recieverPubKey);
        const signature = await splToken.transfer(connection, keypair, fromTokenAccount.address, associatedDestinationTokenAddr.address, keypair.publicKey, amt * 1000000);
        return signature;
    }
    catch (error) {
        console.error(error);
    }
}
// sendSplToken(
//   0.11,
//   publicKey2,
//   privateKey,
//   "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
// );
async function getTokenAccountsByOwner(owner) {
    const tokenResp = await connection.getTokenAccountsByOwner(owner, {
        programId: raydium_sdk_1.TOKEN_PROGRAM_ID,
    });
    const accounts = [];
    for (const { pubkey, account } of tokenResp.value) {
        accounts.push({
            pubkey,
            accountInfo: raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(account.data),
        });
    }
    console.log(accounts);
    return accounts;
}
exports.getTokenAccountsByOwner = getTokenAccountsByOwner;
//   getTokenAccountsByOwner(publicKey)
const getPoolInfo = async (tokenAddress1, tokenAddress2) => {
    // fetch the liquidity pool list
    const liquidityJsonResp = await fetch(RAYDIUM_LIQUIDITY_JSON);
    if (!(await liquidityJsonResp).ok)
        return [];
    const liquidityJson = await liquidityJsonResp.json();
    // console.log(liquidityJson)
    const allPoolKeysJson = [
        ...(liquidityJson?.official ?? []),
        ...(liquidityJson?.unOfficial ?? []),
    ];
    // find the liquidity pair
    const poolKeysRaySolJson = allPoolKeysJson.filter((item) => item.baseMint === tokenAddress1 &&
        item.quoteMint === tokenAddress2 &&
        item.marketVersion === 4) || null;
    return poolKeysRaySolJson[0];
};
async function swap(secretKey, tokenAddress1, tokenAddress2, amt, direction) {
    const poolInfo = await getPoolInfo(tokenAddress1, tokenAddress2);
    console.log(poolInfo);
    const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(secretKey));
    const tokenAcc1 = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, new web3.PublicKey(tokenAddress1), keypair.publicKey);
    const tokenAcc2 = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, new web3.PublicKey(tokenAddress2), keypair.publicKey);
    console.log({ tokenAcc1, tokenAcc2 });
    // console.log(tokenAcc1)
    const keys = (0, raydium_sdk_1.jsonInfo2PoolKeys)(poolInfo);
    // console.log(keys)
    const { innerTransaction } = await raydium_sdk_1.Liquidity.makeSwapInstruction({
        poolKeys: keys,
        userKeys: {
            tokenAccountIn: new web3.PublicKey(direction !== "sell" ? tokenAcc1.address : tokenAcc2.address),
            tokenAccountOut: new web3.PublicKey(direction === "sell" ? tokenAcc1.address : tokenAcc2.address),
            owner: keypair.publicKey,
        },
        amountIn: amt *
            10 **
                (direction !== "sell" ? poolInfo.baseDecimals : poolInfo.quoteDecimals),
        amountOut: 1,
        fixedSide: "in",
    });
    console.log(innerTransaction);
    const transaction = new web3.Transaction().add(innerTransaction.instructions[0]);
    const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
        keypair,
    ]);
}
async function getKey() {
    const liquidityJsonResp = await fetch(RAYDIUM_LIQUIDITY_JSON);
    if (!(await liquidityJsonResp).ok)
        return [];
    const liquidityJson = await liquidityJsonResp.json();
    // console.log(liquidityJson)
    const allPoolKeysJson = [
        ...(liquidityJson?.official ?? []),
        ...(liquidityJson?.unOfficial ?? []),
    ];
    // find the liquidity pair
    const poolKeysRaySolJson = allPoolKeysJson.filter((item) => item.lpMint === "89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip") || null;
    console.log(poolKeysRaySolJson);
}
async function sendTx(connection, transaction, signers) {
    let txRetry = 0;
    console.log("signers len:", signers.length);
    console.log("transaction instructions len:", transaction.instructions.length);
    transaction.instructions.forEach((ins) => {
        console.log(ins.programId.toBase58());
        ins.keys.forEach((m) => {
            console.log("\t", m.pubkey.toBase58(), m.isSigner, m.isWritable);
        });
        console.log("\t datasize:", ins.data.length);
    });
    transaction.recentBlockhash = (await connection.getLatestBlockhash("processed")).blockhash;
    transaction.sign(...signers);
    const rawTransaction = transaction.serialize();
    console.log("packsize :", rawTransaction.length);
    while (++txRetry <= 3) {
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        });
        let url = `${txRetry}, https://solscan.io/tx/${txid}`;
        if (connection.rpcEndpoint.includes("dev"))
            url += "?cluster=devnet";
        console.log(url);
        await new Promise((resolve) => setTimeout(resolve, 1000 * 6));
        const ret = await connection.getSignatureStatus(txid, {
            searchTransactionHistory: true,
        });
        try {
            //@ts-ignore
            if (ret.value && ret.value.err == null) {
                console.log(txRetry, "success");
                break;
            }
            else {
                console.log(txRetry, "failed", ret);
            }
        }
        catch (e) {
            console.log(txRetry, "failed", ret);
        }
    }
}
async function createWsol(connection, ownerKeypair, amount) {
    const ata = await splToken.getOrCreateAssociatedTokenAccount(connection, ownerKeypair, new web3.PublicKey("So11111111111111111111111111111111111111112"), ownerKeypair.publicKey);
    console.log(ata);
    const wsol2 = await web3.SystemProgram.transfer({
        fromPubkey: ownerKeypair.publicKey,
        toPubkey: ata.address,
        lamports: amount * web3.LAMPORTS_PER_SOL,
    });
    console.log({ wsol2 });
    const tx = await web3.sendAndConfirmTransaction(connection, new web3.Transaction().add(wsol2, (0, spl_token_1.createSyncNativeInstruction)(ata.address)), [ownerKeypair]);
    console.log(tx);
    // response.value.forEach((x) => {console.log(x.account.data)})
}
exports.createWsol = createWsol;
// createWsol(
//   connection,
//   web3.Keypair.fromSecretKey(base58.decode(privateKey)),
//   0.001
// );
async function unwrapSol(connection, ownerKeypair) {
    const ata = await splToken.getOrCreateAssociatedTokenAccount(connection, ownerKeypair, new web3.PublicKey("So11111111111111111111111111111111111111112"), ownerKeypair.publicKey);
    console.log(ata);
    const unwrap = (0, spl_token_1.createCloseAccountInstruction)(ata.address, ownerKeypair.publicKey, ownerKeypair.publicKey);
    console.log(unwrap);
    const tx = await web3.sendAndConfirmTransaction(connection, new web3.Transaction().add(unwrap), [ownerKeypair]);
    console.log(tx);
}
// unwrapSol(connection, web3.Keypair.fromSecretKey(base58.decode(privateKey)))
async function swapSolToToken(connection, privateKey, amount, tokenAddress1, tokenAddress2) {
    const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
    await createWsol(connection, keypair, amount);
    await swap(privateKey, tokenAddress1, tokenAddress2, amount, "bye");
    await unwrapSol(connection, keypair);
}
// swapSolToToken(connection, privateKey, 0.001, "So11111111111111111111111111111111111111112",
// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
async function swapTokenToSol(connection, privateKey, amount, tokenAddress1, tokenAddress2) {
    const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
    await createWsol(connection, keypair, 0);
    await swap(privateKey, tokenAddress2, tokenAddress1, amount, "sell");
    await unwrapSol(connection, keypair);
}
// swapTokenToSol(connection, privateKey, 0.1,
// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "So11111111111111111111111111111111111111112")
async function swapTokenToToken(connection, privateKey, amount, tokenAddress1, tokenAddress2) {
    const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
    await swap(privateKey, tokenAddress2, tokenAddress1, amount);
}
async function estimateGas(privateKey, method) {
    const keypair = web3.Keypair.fromSecretKey(bs58_1.default.decode(privateKey));
    const ata = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, new web3.PublicKey("So11111111111111111111111111111111111111112"), keypair.publicKey);
    const transaction = new web3.Transaction().add((0, spl_token_1.createCloseAccountInstruction)(ata.address, keypair.publicKey, keypair.publicKey));
    let blockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    const response = await connection.getFeeForMessage(transaction.compileMessage(), "confirmed");
    const feeInLamports = response.value;
    console.log(feeInLamports);
    const poolInfo = await getPoolInfo("So11111111111111111111111111111111111111112", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
    const tokenAcc1 = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, new web3.PublicKey("So11111111111111111111111111111111111111112"), keypair.publicKey);
    const tokenAcc2 = await splToken.getOrCreateAssociatedTokenAccount(connection, keypair, new web3.PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), keypair.publicKey);
    console.log({ tokenAcc1, tokenAcc2 });
    // console.log(tokenAcc1)
    const keys = (0, raydium_sdk_1.jsonInfo2PoolKeys)(poolInfo);
    const { innerTransaction } = await raydium_sdk_1.Liquidity.makeSwapInstruction({
        poolKeys: keys,
        userKeys: {
            tokenAccountIn: new web3.PublicKey("So11111111111111111111111111111111111111112"),
            tokenAccountOut: new web3.PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
            owner: keypair.publicKey,
        },
        amountIn: 1111 * 10 ** 6,
        amountOut: 1,
        fixedSide: "in",
    });
    console.log(innerTransaction);
    const transaction2 = new web3.Transaction().add(innerTransaction.instructions[0]);
    transaction2.recentBlockhash = blockhash;
    transaction2.feePayer = keypair.publicKey;
    const response2 = await connection.getFeeForMessage(transaction2.compileMessage(), "confirmed");
    const feeInLamports2 = response.value;
    console.log(feeInLamports2);
    switch (method) {
        case "swapTokenToToken":
            return feeInLamports2;
        case "swapSolToToken":
            console.log(feeInLamports2 && feeInLamports ? feeInLamports2 + feeInLamports * 2 : null);
            return feeInLamports2 && feeInLamports ? feeInLamports2 + feeInLamports * 2 : null;
        case "swapTokenToSol":
            return feeInLamports2 && feeInLamports ? feeInLamports2 + feeInLamports * 2 : null;
    }
}
estimateGas(privateKey, "swapSolToToken");
