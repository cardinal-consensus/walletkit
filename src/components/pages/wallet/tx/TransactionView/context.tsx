import type {
  SmartWalletEvents,
  SmartWalletTransactionData,
} from "@gokiprotocol/client";
import type { ParsedAccountInfo } from "@saberhq/sail";
import { SolanaProvider, TransactionEnvelope } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { TransactionResponse } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { createContainer } from "unstated-next";

import { useSignaturesForAddress } from "../../../../../hooks/useSignaturesForAddress";
import type { ParsedTX } from "../../../../../hooks/useSmartWallet";
import {
  SMART_WALLET_CODER,
  useSmartWallet,
} from "../../../../../hooks/useSmartWallet";
import { useTransactions } from "../../../../../hooks/useTransactions";
import { displayAddress } from "../../../../../utils/programs";
import { shortenAddress } from "../../../../../utils/utils";

interface LoadedTransaction extends ParsedTX {
  tx: ParsedAccountInfo<SmartWalletTransactionData>;
}

export interface DetailedTransaction extends LoadedTransaction {
  index: number;
  id: string;
  title: string;
  historicalTXs?: HistoricalTX[];
  eta: Date | null;
  executedAt: Date | null;
  txEnv: TransactionEnvelope | null;
  state: "stale" | "active" | "approved" | "executed";
  numSigned: number;
}

export interface HistoricalTX extends TransactionResponse {
  sig: string;
  date: Date | null | undefined;
  events: readonly SmartWalletEvent[];
}

export type SmartWalletEvent = SmartWalletEvents[keyof SmartWalletEvents];

const useTransactionInner = (tx?: LoadedTransaction): DetailedTransaction => {
  if (!tx) {
    throw new Error(`missing tx`);
  }
  const { smartWalletData } = useSmartWallet();
  const { provider, providerMut, network } = useSolana();
  const index = tx.tx.accountInfo.data.index.toNumber();

  const id = `TX-${index}`;
  const title = `${
    tx.instructions
      ?.map(
        (ix) =>
          (ix.parsed && "name" in ix.parsed
            ? `${
                ix.programName ?? displayAddress(ix.ix.programId.toString())
              }: ${ix.parsed.name.toString()}`
            : null) ??
          `Interact with ${
            ix.programName ?? shortenAddress(ix.ix.programId.toString())
          }`
      )
      .join(", ") ?? "Unknown Trnasaction"
  }`;

  const { data: txData } = tx.tx.accountInfo;

  const txEnv = useMemo(() => {
    return new TransactionEnvelope(
      providerMut ??
        SolanaProvider.load({
          connection: provider.connection,
          sendConnection: provider.connection,
          wallet: {
            publicKey:
              network === "devnet"
                ? new PublicKey("A2jaCHPzD6346348JoEym2KFGX9A7uRBw6AhCdX7gTWP")
                : new PublicKey("9u9iZBWqGsp5hXBxkVZtBTuLSGNAG9gEQLgpuVw39ASg"),
            signTransaction: () => {
              throw new Error("unimplemented");
            },
            signAllTransactions: () => {
              throw new Error("unimplemented");
            },
          },
        }),
      tx.tx.accountInfo.data.instructions.map((ix) => ({
        ...ix,
        data: Buffer.from(ix.data as Uint8Array),
      }))
    );
  }, [
    network,
    provider.connection,
    providerMut,
    tx.tx.accountInfo.data.instructions,
  ]);

  const etaRaw = txData.eta.toNumber();
  const eta = etaRaw === -1 ? null : new Date(etaRaw * 1_000);
  const executedAtNum = tx.tx.accountInfo.data.executedAt.toNumber();
  const executedAt =
    executedAtNum === -1 ? null : new Date(executedAtNum * 1_000);

  const sigs = useSignaturesForAddress(tx.tx.accountId);
  const historicalTXsRaw = useTransactions(
    sigs.data?.map((s) => s.signature) ?? []
  );

  const historicalTXs = useMemo(() => {
    return historicalTXsRaw
      .map(({ data: resp }): HistoricalTX | null => {
        if (!resp) {
          return null;
        }
        const events = SMART_WALLET_CODER.parseProgramLogEvents(
          resp.tx.meta?.logMessages ?? []
        );
        return {
          ...resp.tx,
          events,
          sig: resp.sig,
          date:
            typeof resp.tx.blockTime === "number"
              ? new Date(resp.tx.blockTime * 1_000)
              : resp.tx.blockTime,
        };
      })
      .filter((t): t is HistoricalTX => !!t);
  }, [historicalTXsRaw]);

  const numSigned = (
    (tx?.tx.accountInfo.data.signers ?? []) as boolean[]
  ).filter((x) => !!x).length;

  const isOwnerSetValid =
    tx.tx.accountInfo.data.ownerSetSeqno ===
    smartWalletData?.accountInfo.data.ownerSetSeqno;
  const threshold = smartWalletData
    ? smartWalletData.accountInfo.data?.threshold.toNumber()
    : null;
  const state = executedAt
    ? "executed"
    : !isOwnerSetValid
    ? "stale"
    : typeof threshold === "number" && numSigned >= threshold
    ? "approved"
    : "active";

  return {
    ...tx,
    id,
    index,
    title,
    historicalTXs,
    eta,
    executedAt,
    txEnv,
    state,
    numSigned,
  };
};

export const { useContainer: useTransaction, Provider: TransactionProvider } =
  createContainer(useTransactionInner);
