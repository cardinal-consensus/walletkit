import { useUserAssociatedTokenAccounts } from "@quarryprotocol/react-quarry";
import { SliderHandle, SliderRange, SliderTrack } from "@reach/slider";
import { useSail } from "@saberhq/sail";
import { Fraction, u64 } from "@saberhq/token-utils";
import type { VoteEscrow } from "@tribecahq/tribeca-sdk";
import { LockerWrapper } from "@tribecahq/tribeca-sdk";
import BN from "bn.js";
import formatDuration from "date-fns/formatDuration";
import { useState } from "react";
import { FaArrowDown } from "react-icons/fa";
import invariant from "tiny-invariant";
import tw from "twin.macro";

import { useSDK } from "../../../../../contexts/sdk";
import { useParseTokenAmount } from "../../../../../hooks/useParseTokenAmount";
import { tsToDate } from "../../../../../utils/utils";
import { AttributeList } from "../../../../common/AttributeList";
import { Button } from "../../../../common/Button";
import { HelperCard } from "../../../../common/HelperCard";
import { InputSlider } from "../../../../common/inputs/InputSlider";
import { InputTokenAmount } from "../../../../common/inputs/InputTokenAmount";
import { LoadingSpinner } from "../../../../common/LoadingSpinner";
import type { ModalProps } from "../../../../common/Modal";
import { Modal } from "../../../../common/Modal";
import { useLocker, useUserEscrow } from "../../hooks/useEscrow";
import { useGovernor } from "../../hooks/useGovernor";

type Props = Omit<ModalProps, "children"> & {
  escrowW: VoteEscrow | null;
  variant: "lock" | "refresh" | null;
};

const ONE_DAY = 86_400;
const ONE_YEAR = ONE_DAY * 365;

const normalizeDuration = (seconds: number): Duration => {
  if (seconds >= ONE_YEAR) {
    return {
      years: Math.floor(seconds / ONE_YEAR),
      days: Math.floor((seconds % ONE_YEAR) / ONE_DAY),
    };
  }
  if (seconds >= ONE_DAY) {
    return {
      days: Math.floor(seconds / ONE_DAY),
    };
  }
  return {
    seconds,
  };
};

export const formatDurationSeconds = (seconds: number) =>
  formatDuration(normalizeDuration(seconds));

const nicePresets = (
  minLockupSeconds: number,
  maxLockupSeconds: number
): { duration: Duration; seconds: number }[] => {
  const result = [];
  if (maxLockupSeconds > ONE_DAY * 30) {
    result.push(ONE_DAY * 30);
  }
  if (maxLockupSeconds > ONE_YEAR) {
    result.push(ONE_YEAR);
  }
  return [minLockupSeconds, ...result.slice(-3), maxLockupSeconds].map(
    (seconds) => ({
      seconds,
      duration: normalizeDuration(seconds),
    })
  );
};

export const LockEscrowModal: React.FC<Props> = ({
  variant,
  ...modalProps
}: Props) => {
  const { tribecaMut } = useSDK();
  const { governor, veToken, govToken } = useGovernor();
  const { data: locker } = useLocker();
  const { data: escrow, refetch } = useUserEscrow();
  const [userBalance] = useUserAssociatedTokenAccounts([govToken]);
  const [lockDurationSeconds, setDurationSeconds] = useState<string>(
    ONE_DAY.toString()
  );
  const parsedDurationSeconds = parseFloat(lockDurationSeconds);
  const { handleTX } = useSail();

  const durations = locker
    ? ([
        locker.accountInfo.data.params.minStakeDuration.toNumber(),
        locker.accountInfo.data.params.maxStakeDuration.toNumber(),
      ] as const)
    : locker;

  const durationPresets = durations
    ? nicePresets(durations[0], durations[1])
    : [];

  const [depositAmountStr, setDepositAmountStr] = useState<string>("");
  const depositAmount = useParseTokenAmount(govToken, depositAmountStr);

  const prevUnlockTime = escrow ? tsToDate(escrow.escrow.escrowEndsAt) : null;
  const unlockTime = new Date(Date.now() + parsedDurationSeconds * 1_000);
  const isInvalidUnlockTime = prevUnlockTime && unlockTime < prevUnlockTime;

  const currentVotingPower =
    escrow && govToken
      ? parseFloat(escrow.calculateVotingPower(Date.now() / 1_000).toString()) /
        10 ** govToken.decimals
      : 0;

  const newVotingPower =
    govToken && locker
      ? new Fraction(
          escrow?.escrow?.amount.toNumber() ?? 0,
          10 ** govToken?.decimals
        )
          .add(depositAmount?.asFraction ?? 0)
          .multiply(locker.accountInfo.data.params.maxStakeVoteMultiplier)
          .multiply(parsedDurationSeconds)
          .divide(locker.accountInfo.data.params.maxStakeDuration).asNumber
      : null;

  return (
    <Modal tw="p-0 dark:text-white" {...modalProps}>
      <div tw="h-14 flex items-center px-8 border-b dark:border-warmGray-700">
        <h1 tw="font-medium text-base">
          {variant === "refresh" ? "Refresh Lockup" : "Lock Tokens"}
        </h1>
      </div>
      <div tw="px-8 py-4">
        <div tw="flex flex-col gap-8">
          {variant === "refresh" && (
            <HelperCard>
              <p>
                Refresh your lockup to increase the voting power of your current
                token stake.
              </p>
            </HelperCard>
          )}
          {variant === "lock" && (
            <InputTokenAmount
              tokens={[]}
              label="Deposit Amount"
              token={govToken ?? null}
              inputValue={depositAmountStr}
              inputOnChange={setDepositAmountStr}
              currentAmount={{
                amount: userBalance?.balance,
                allowSelect: true,
              }}
            />
          )}
          <div>
            <div tw="flex flex-col gap-2">
              <span tw="font-medium text-sm">Lock Period</span>
              <div
                tw="text-4xl my-6"
                css={[isInvalidUnlockTime && tw`text-red-500`]}
              >
                {formatDuration(
                  normalizeDuration(
                    Math.floor(parsedDurationSeconds / 86_400) * 86_400
                  )
                )}
              </div>
              <div tw="w-11/12 mx-auto my-4">
                <InputSlider
                  value={parsedDurationSeconds}
                  min={durations?.[0]}
                  max={durations?.[1]}
                  step={1}
                  onChange={(e) => setDurationSeconds(e.toFixed(2))}
                >
                  <SliderTrack>
                    <SliderRange />
                    <SliderHandle />
                  </SliderTrack>
                </InputSlider>
              </div>
              <div tw="flex gap-4 mx-auto mt-4 flex-wrap">
                {durationPresets.map(({ duration, seconds }, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    tw="px-4 rounded border-primary hover:border-primary bg-primary bg-opacity-20"
                    onClick={() => {
                      setDurationSeconds(seconds.toString());
                    }}
                  >
                    {formatDuration(duration)}
                  </Button>
                ))}
              </div>
              <div tw="py-6 flex items-center justify-center">
                <FaArrowDown />
              </div>
              <div tw="mb-6 border rounded border-warmGray-800">
                {!veToken ? (
                  <div tw="w-full py-5 flex items-center justify-center">
                    <LoadingSpinner tw="h-8 w-8" />
                  </div>
                ) : (
                  <AttributeList
                    rowStyles={tw`items-start gap-4`}
                    labelStyles={tw`w-32`}
                    valueStyles={tw`flex-grow`}
                    transformLabel={false}
                    attributes={{
                      [`${veToken.symbol} balance`]: (
                        <div tw="flex flex-col">
                          <div>
                            <span tw="text-warmGray-400">Prev: </span>
                            <span>{currentVotingPower.toLocaleString()}</span>
                          </div>
                          <div>
                            <span tw="text-warmGray-400">Next: </span>
                            <span>{newVotingPower?.toLocaleString()}</span>
                          </div>
                        </div>
                      ),
                      "Unlock Time": (
                        <div tw="flex flex-col">
                          <div>
                            <span tw="text-warmGray-400">Prev: </span>
                            <span>
                              {prevUnlockTime?.toLocaleString(undefined, {
                                timeZoneName: "short",
                              }) ?? "n/a"}
                            </span>
                          </div>
                          <div>
                            <span tw="text-warmGray-400">Next: </span>
                            <span>
                              {unlockTime.toLocaleString(undefined, {
                                timeZoneName: "short",
                              })}
                            </span>
                          </div>
                        </div>
                      ),
                    }}
                  />
                )}
              </div>
              <Button
                size="md"
                variant="primary"
                disabled={!tribecaMut || !locker || !!isInvalidUnlockTime}
                onClick={async () => {
                  invariant(tribecaMut && locker);
                  const lockerW = new LockerWrapper(
                    tribecaMut,
                    locker.accountId,
                    governor
                  );
                  const tx = await lockerW.lockTokens({
                    amount: depositAmount?.toU64() ?? new u64(0),
                    duration: new BN(parsedDurationSeconds),
                  });
                  const { pending, success } = await handleTX(
                    tx,
                    `Lock tokens`
                  );
                  if (!pending || !success) {
                    return;
                  }
                  await pending.wait();
                  await refetch();
                  modalProps.onDismiss();
                }}
              >
                {isInvalidUnlockTime
                  ? "Cannot decrease lock time"
                  : variant === "refresh"
                  ? "Refresh Lockup"
                  : "Lock Tokens"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
