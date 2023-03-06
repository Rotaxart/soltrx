import * as web3 from "@solana/web3.js";
import base58 from "bs58";
import * as splToken from "@solana/spl-token";
import {
  jsonInfo2PoolKeys,
  Liquidity,
  SPL_ACCOUNT_LAYOUT,
  TOKEN_PROGRAM_ID,
} from "@raydium-io/raydium-sdk";
import { version } from "os";
import {
  createCloseAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";

const RAY_SOL_LP_V4_POOL_KEY = "89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip";
const RAYDIUM_LIQUIDITY_JSON =
  "https://api.raydium.io/v2/sdk/liquidity/mainnet.json";

const privateKey =
  "";
const publicKey = new web3.PublicKey(
  "ABmR5nuWyyMsxdzpKzc1kyhBwL8UBwk2CgTB42oHLCTh"
);
const publicKey2 = new web3.PublicKey(
  "BpU1rNZu55z7ZJ3PdHjYkDZTtZsAK3rMEy8nNduJeczA"
);

const connection: web3.Connection = new web3.Connection(
  web3.clusterApiUrl("mainnet-beta")
);

async function sendSol(
  amt: number,
  recieverAddress: string,
  privateKey: string
) {
  try {
    const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));
    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new web3.PublicKey(recieverAddress),
        lamports: web3.LAMPORTS_PER_SOL * amt,
      })
    );
    const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);
    return tx;
  } catch (error) {
    console.error(error);
  }
}

// sendSol(0.1, publicKey2, privateKey)

async function sendSplToken(
  amt: number,
  recieverAddress: string,
  privateKey: string,
  tokenAddress: string
) {
  try {
    const tokenPubKey = new web3.PublicKey(tokenAddress);
    const mint = new web3.PublicKey(tokenAddress);
    const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));
    const recieverPubKey = new web3.PublicKey(recieverAddress);
    const { TOKEN_PROGRAM_ID } = splToken;

    const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey
    );

    const associatedDestinationTokenAddr =
      await splToken.getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        tokenPubKey,
        recieverPubKey
      );

    const signature = await splToken.transfer(
      connection,
      keypair,
      fromTokenAccount.address,
      associatedDestinationTokenAddr.address,
      keypair.publicKey,
      amt * 1000000
    );

    return signature;
  } catch (error) {
    console.error(error);
  }
}

// sendSplToken(
//   0.11,
//   publicKey2,
//   privateKey,
//   "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
// );

export async function getTokenAccountsByOwner(owner: web3.PublicKey) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts = [];

  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

//   getTokenAccountsByOwner(publicKey)

const getPoolInfo = async (tokenAddress1: string, tokenAddress2: string) => {
  // fetch the liquidity pool list
  const liquidityJsonResp = await fetch(RAYDIUM_LIQUIDITY_JSON);

  if (!(await liquidityJsonResp).ok) return [];
  const liquidityJson = await liquidityJsonResp.json();
  const allPoolKeysJson = [
    ...(liquidityJson?.official ?? []),
    ...(liquidityJson?.unOfficial ?? []),
  ];
  // find the liquidity pair
  const poolKeysRaySolJson =
    allPoolKeysJson.filter(
      (item) =>
        item.baseMint === tokenAddress1 &&
        item.quoteMint === tokenAddress2 &&
        item.marketVersion === 4
    ) || null;

  return poolKeysRaySolJson[0];
};

async function swap(
  secretKey: string,
  tokenAddress1: string,
  tokenAddress2: string,
  amt: number,
  direction?: string
) {
  const poolInfo = await getPoolInfo(tokenAddress1, tokenAddress2);

  const keypair = web3.Keypair.fromSecretKey(base58.decode(secretKey));

  const tokenAcc1: splToken.Account =
    await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      new web3.PublicKey(tokenAddress1),
      keypair.publicKey
    );

  const tokenAcc2 = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    new web3.PublicKey(tokenAddress2),
    keypair.publicKey
  );

  const keys: any = jsonInfo2PoolKeys(poolInfo);
  const { innerTransaction } = await Liquidity.makeSwapInstruction({
    poolKeys: keys,
    userKeys: {
      tokenAccountIn: new web3.PublicKey(
        direction !== "sell" ? tokenAcc1.address : tokenAcc2.address
      ),
      tokenAccountOut: new web3.PublicKey(
        direction === "sell" ? tokenAcc1.address : tokenAcc2.address
      ),
      owner: keypair.publicKey,
    },
    amountIn:
      amt *
      10 **
        (direction !== "sell" ? poolInfo.baseDecimals : poolInfo.quoteDecimals),
    amountOut: 1,
    fixedSide: "in",
  });
  const transaction = new web3.Transaction().add(
    innerTransaction.instructions[0]
  );

  const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
    keypair,
  ]);
}

async function getKey() {
  const liquidityJsonResp = await fetch(RAYDIUM_LIQUIDITY_JSON);

  if (!(await liquidityJsonResp).ok) return [];
  const liquidityJson = await liquidityJsonResp.json();
  const allPoolKeysJson = [
    ...(liquidityJson?.official ?? []),
    ...(liquidityJson?.unOfficial ?? []),
  ];
  const poolKeysRaySolJson =
    allPoolKeysJson.filter(
      (item) => item.lpMint === "89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip"
    ) || null;
}

async function sendTx(
  connection: web3.Connection,
  transaction: web3.Transaction,
  signers: Array<web3.Signer>
) {
  let txRetry = 0;

  transaction.instructions.forEach((ins) => {
    ins.keys.forEach((m) => {});
  });

  transaction.recentBlockhash = (
    await connection.getLatestBlockhash("processed")
  ).blockhash;

  transaction.sign(...signers);
  const rawTransaction = transaction.serialize();

  while (++txRetry <= 3) {
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    let url = `${txRetry}, https://solscan.io/tx/${txid}`;
    if (connection.rpcEndpoint.includes("dev")) url += "?cluster=devnet";

    await new Promise((resolve) => setTimeout(resolve, 1000 * 6));
    const ret = await connection.getSignatureStatus(txid, {
      searchTransactionHistory: true,
    });
    try {
      //@ts-ignore
      if (ret.value && ret.value.err == null) {
        break;
      } else {
      }
    } catch (e) {}
  }
}

export async function createWsol(
  connection: web3.Connection,
  ownerKeypair: web3.Keypair,
  amount: number
) {
  const ata: splToken.Account =
    await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      ownerKeypair,
      new web3.PublicKey("So11111111111111111111111111111111111111112"),
      ownerKeypair.publicKey
    );

  const wsol2 = await web3.SystemProgram.transfer({
    fromPubkey: ownerKeypair.publicKey,
    toPubkey: ata.address,
    lamports: amount * web3.LAMPORTS_PER_SOL,
  });

  const tx = await web3.sendAndConfirmTransaction(
    connection,
    new web3.Transaction().add(wsol2, createSyncNativeInstruction(ata.address)),
    [ownerKeypair]
  );
}
// createWsol(
//   connection,
//   web3.Keypair.fromSecretKey(base58.decode(privateKey)),
//   0.001
// );
async function unwrapSol(
  connection: web3.Connection,
  ownerKeypair: web3.Keypair
) {
  const ata: splToken.Account =
    await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      ownerKeypair,
      new web3.PublicKey("So11111111111111111111111111111111111111112"),
      ownerKeypair.publicKey
    );
  const unwrap = createCloseAccountInstruction(
    ata.address,
    ownerKeypair.publicKey,
    ownerKeypair.publicKey
  );

  const tx = await web3.sendAndConfirmTransaction(
    connection,
    new web3.Transaction().add(unwrap),
    [ownerKeypair]
  );
}

// unwrapSol(connection, web3.Keypair.fromSecretKey(base58.decode(privateKey)))

async function swapSolToToken(
  connection: web3.Connection,
  privateKey: string,
  amount: number,
  tokenAddress1: string,
  tokenAddress2: string
) {
  const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));
  await createWsol(connection, keypair, amount);
  await swap(privateKey, tokenAddress1, tokenAddress2, amount, "bye");
  await unwrapSol(connection, keypair);
}

// swapSolToToken(connection, privateKey, 0.001, "So11111111111111111111111111111111111111112",
// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")

async function swapTokenToSol(
  connection: web3.Connection,
  privateKey: string,
  amount: number,
  tokenAddress1: string,
  tokenAddress2: string
) {
  const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));
  await createWsol(connection, keypair, 0);
  await swap(privateKey, tokenAddress2, tokenAddress1, amount, "sell");
  await unwrapSol(connection, keypair);
}

// swapTokenToSol(connection, privateKey, 0.1,
// "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "So11111111111111111111111111111111111111112")

async function swapTokenToToken(
  connection: web3.Connection,
  privateKey: string,
  amount: number,
  tokenAddress1: string,
  tokenAddress2: string
) {
  const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));

  await swap(privateKey, tokenAddress2, tokenAddress1, amount);
}

async function estimateGas(privateKey: string, method: string) {
  const keypair = web3.Keypair.fromSecretKey(base58.decode(privateKey));

  const ata = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    new web3.PublicKey("So11111111111111111111111111111111111111112"),
    keypair.publicKey
  );

  const transaction = new web3.Transaction().add(
    createCloseAccountInstruction(
      ata.address,
      keypair.publicKey,
      keypair.publicKey
    )
  );

  let blockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = keypair.publicKey;

  const response = await connection.getFeeForMessage(
    transaction.compileMessage(),
    "confirmed"
  );
  const feeInLamports = response.value;

  const poolInfo = await getPoolInfo(
    "So11111111111111111111111111111111111111112",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
  );

  const tokenAcc1: splToken.Account =
    await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      new web3.PublicKey("So11111111111111111111111111111111111111112"),
      keypair.publicKey
    );

  const tokenAcc2 = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    new web3.PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    keypair.publicKey
  );

  const keys: any = jsonInfo2PoolKeys(poolInfo);

  const { innerTransaction } = await Liquidity.makeSwapInstruction({
    poolKeys: keys,
    userKeys: {
      tokenAccountIn: new web3.PublicKey(
        "So11111111111111111111111111111111111111112"
      ),
      tokenAccountOut: new web3.PublicKey(
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
      ),
      owner: keypair.publicKey,
    },
    amountIn: 1111 * 10 ** 6,
    amountOut: 1,
    fixedSide: "in",
  });
  const transaction2 = new web3.Transaction().add(
    innerTransaction.instructions[0]
  );

  transaction2.recentBlockhash = blockhash;
  transaction2.feePayer = keypair.publicKey;

  const response2 = await connection.getFeeForMessage(
    transaction2.compileMessage(),
    "confirmed"
  );

  const feeInLamports2 = response.value;

  switch (method) {
    case "swapTokenToToken":
      return feeInLamports2;
    case "swapSolToToken":
      return feeInLamports2 && feeInLamports
        ? feeInLamports2 + feeInLamports * 2
        : null;
    case "swapTokenToSol":
      return feeInLamports2 && feeInLamports
        ? feeInLamports2 + feeInLamports * 2
        : null;
  }
}

// estimateGas(privateKey, "swapSolToToken");
