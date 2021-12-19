import { VoteSide } from "@tribecahq/tribeca-sdk";
import tw from "twin.macro";

import { ModalButton } from "../../../../../common/Modal/ModalButton";
import type { ProposalInfo } from "../../../hooks/useProposals";
import { CastVoteModal } from "./CastVoteModal";

interface Props {
  proposalInfo: ProposalInfo;
  side: VoteSide | null;
}

export const CastVoteButton: React.FC<Props> = ({
  proposalInfo,
  side,
}: Props) => {
  return (
    <ModalButton
      tw="max-w-md"
      buttonProps={{
        variant: "outline",
        css: tw`border-white hover:(border-primary bg-primary bg-opacity-20)`,
      }}
      buttonLabel={side === VoteSide.Pending ? "Cast Vote" : "Change Vote"}
    >
      <CastVoteModal proposalInfo={proposalInfo} />
    </ModalButton>
  );
};