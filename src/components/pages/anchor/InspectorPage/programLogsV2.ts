import type { TransactionError } from "@solana/web3.js";
import { theme } from "twin.macro";

import { getTransactionInstructionError } from "./programErr";

export type LogStyle = "muted" | "info" | "success" | "warning";

export const styleColor = (style: LogStyle | "white"): string => {
  switch (style) {
    case "white":
      return theme`colors.white`;
    case "muted":
      return theme`colors.slate.400`;
    case "info":
      return theme`colors.blue.400`;
    case "success":
      return theme`colors.primary.500`;
    case "warning":
      return theme`colors.accent.500`;
  }
};

export type LogEntry = {
  depth: number;
  style: LogStyle;
} & (
  | {
      type: "text";
      text: string;
    }
  | {
      type: "system";
      text: string;
    }
  | {
      type: "cpi";
      programAddress: string | null;
    }
  | {
      type: "success";
    }
  | {
      type: "programError";
      text: string;
    }
  | {
      type: "runtimeError";
      text: string;
    }
);

export type InstructionLogs = {
  logs: LogEntry[];
  failed: boolean;
};

/**
 * Stack-aware program log parser.
 * @param logs
 * @param error
 * @returns
 */
export const parseProgramLogs = (
  logs: string[] | null,
  error: TransactionError | null
): InstructionLogs[] => {
  let depth = 0;
  const prettyLogs: InstructionLogs[] = [];

  let prettyError;
  if (!logs) {
    if (error) throw new Error(JSON.stringify(error));
    throw new Error("No logs detected");
  } else if (error) {
    prettyError = getTransactionInstructionError(error);
  }

  logs.forEach((log) => {
    if (log.startsWith("Program log:")) {
      prettyLogs[prettyLogs.length - 1]?.logs.push({
        type: "text",
        depth,
        text: log,
        style: "muted",
      });
    } else {
      const regex = /Program (\w*) invoke \[(\d)\]/g;
      const matches = [...log.matchAll(regex)];

      if (matches.length > 0) {
        const programAddress = matches[0]?.[1];

        if (depth === 0) {
          prettyLogs.push({
            logs: [],
            failed: false,
          });
        } else {
          prettyLogs[prettyLogs.length - 1]?.logs.push({
            type: "cpi",
            depth,
            style: "info",
            programAddress: programAddress ?? null,
          });
        }

        depth++;
      } else if (log.includes("success")) {
        prettyLogs[prettyLogs.length - 1]?.logs.push({
          type: "success",
          depth,
          style: "success",
        });
        depth--;
      } else if (log.includes("failed")) {
        const instructionLog = prettyLogs[prettyLogs.length - 1];
        if (instructionLog && !instructionLog.failed) {
          instructionLog.failed = true;
          instructionLog.logs.push({
            type: "programError",
            depth,
            style: "warning",
            text: log.slice(log.indexOf(": ") + 2),
          });
        }
        depth--;
      } else {
        if (depth === 0) {
          prettyLogs.push({
            logs: [],
            failed: false,
          });
          depth++;
        }
        // system transactions don't start with "Program log:"
        prettyLogs[prettyLogs.length - 1]?.logs.push({
          type: "system",
          depth,
          text: log,
          style: "muted",
        });
      }
    }
  });

  // If the instruction's simulation returned an error without any logs then add an empty log entry for Runtime error
  // For example BpfUpgradableLoader fails without returning any logs for Upgrade instruction with buffer that doesn't exist
  if (prettyError && prettyLogs.length === 0) {
    prettyLogs.push({
      logs: [],
      failed: true,
    });
  }

  if (prettyError && prettyError.index === prettyLogs.length - 1) {
    const failedIx = prettyLogs[prettyError.index];
    if (failedIx) {
      failedIx.failed = true;
      failedIx.logs.push({
        type: "runtimeError",
        depth: 1,
        text: prettyError.message,
        style: "warning",
      });
    }
  }

  return prettyLogs;
};