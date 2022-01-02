import { startCase } from "lodash";

import type { ProgramInfo } from "../../../../../hooks/useAuthorityPrograms";
import { useIDL } from "../../../../../hooks/useIDLs";
import { programLabel } from "../../../../../utils/programs";
import { shortenAddress } from "../../../../../utils/utils";
import { AddressLink } from "../../../../common/AddressLink";
import { SlotLink } from "../../../../common/SlotLink";

interface Props {
  program: ProgramInfo;
  actions?: React.ReactNode;
}

export const ProgramCard: React.FC<Props> = ({ program, actions }: Props) => {
  const idl = useIDL(program.programID);
  const label =
    programLabel(program.programID.toString()) ??
    (idl.data?.idl
      ? startCase(idl.data.idl.name)
      : shortenAddress(program.programID.toString()));
  return (
    <div tw="flex items-center justify-between py-5 px-6 border-l-2 border-l-transparent border-b border-b-warmGray-800">
      <div tw="flex flex-grow">
        <div tw="flex-basis[236px] flex flex-col gap-1">
          <span tw="font-medium text-white">{label}</span>
          <div tw="text-xs flex gap-1 text-secondary">
            <span>ID:</span>
            <AddressLink address={program.programID} />
          </div>
        </div>
        <div tw="flex lg:ml-12 invisible lg:visible items-center gap-1 text-secondary">
          <span>Deployed At:</span>
          <span>
            <SlotLink slot={program.lastDeploySlot} />
          </span>
        </div>
      </div>
      <div>{actions}</div>
    </div>
  );
};