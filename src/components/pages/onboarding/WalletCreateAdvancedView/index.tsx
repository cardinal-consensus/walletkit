import { useSail } from "@saberhq/sail";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { useFormik } from "formik";
import { uniq } from "lodash";
import { useMemo } from "react";
import { FaPlus, FaQuestionCircle, FaTrash } from "react-icons/fa";
import { useHistory } from "react-router-dom";
import invariant from "tiny-invariant";
import * as Yup from "yup";

import { useSDK } from "../../../../contexts/sdk";
import { useKeypair } from "../../../../hooks/useKeypair";
import { useSmartWalletAddress } from "../../../../hooks/useSmartWalletAddress";
import { handleException } from "../../../../utils/error";
import { notify } from "../../../../utils/notifications";
import { AddressLink } from "../../../common/AddressLink";
import { AttributeList } from "../../../common/AttributeList";
import { Button } from "../../../common/Button";
import { InputText, Textarea } from "../../../common/inputs/InputText";
import { MouseoverTooltip } from "../../../common/MouseoverTooltip";

const CreateFormSchema = Yup.object().shape({
  owners: Yup.array()
    .min(1, "Enter at least one owner")
    .test("invalidKey", "Invalid key", (arr) => {
      if (!arr) {
        return false;
      }
      const last = arr[arr.length - 1] as string | undefined;
      if (!last) {
        return true;
      }
      try {
        new PublicKey(last);
        return true;
      } catch (e) {
        return false;
      }
    }),
  threshold: Yup.number().min(1, "Must have at least one signer required"),
  maxOwners: Yup.number()
    .required()
    .test((v, valuesRaw): boolean | Yup.ValidationError => {
      const values = valuesRaw.parent as CreateFormValues;
      if (typeof v !== "number") {
        return new Yup.ValidationError("Invalid");
      }
      if (v < values.owners.length) {
        return new Yup.ValidationError(
          "Must have more max owners than the initial amount"
        );
      }
      return true;
    }),
  baseKP: Yup.string()
    .required("Required")
    .test("baseKP", "Invalid keypair JSON", (str) => {
      if (!str) {
        return false;
      }
      try {
        Keypair.fromSecretKey(Uint8Array.from(JSON.parse(str) as number[]));
        return true;
      } catch (e) {
        return false;
      }
    }),
  delay: Yup.number().min(0, "Delay must be positive"),
});

interface CreateFormValues {
  owners: string[];
  threshold: number;
  maxOwners: number;
  baseKP: string;
  delay?: number;
}

export const WalletCreateView: React.FC = () => {
  const { handleTX } = useSail();
  const { sdkMut } = useSDK();
  const initialBaseKP = useMemo(
    () => JSON.stringify([...Keypair.generate().secretKey]),
    []
  );
  const history = useHistory();
  const formik = useFormik<CreateFormValues>({
    initialValues: {
      owners: [],
      threshold: 1,
      maxOwners: 10,
      baseKP: initialBaseKP,
      delay: 0,
    },
    validationSchema: CreateFormSchema,
    onSubmit: async (values) => {
      try {
        invariant(sdkMut, "sdk");
        const baseKP = Keypair.fromSecretKey(
          Uint8Array.from(JSON.parse(values.baseKP) as number[])
        );
        const { tx, smartWalletWrapper } = await sdkMut.newSmartWallet({
          owners: uniq(values.owners)
            .filter((x) => !!x)
            .map((owner) => new PublicKey(owner)),
          threshold: new BN(values.threshold),
          numOwners: values.maxOwners,
          base: baseKP,
          delay: values.delay ? new BN(values.delay) : undefined,
        });
        const { pending, success } = await handleTX(tx, "Create Multisig");
        if (!success || !pending) {
          return;
        }
        await pending.wait({ commitment: "confirmed" });

        notify({
          message: `Wallet created successfully`,
          description: smartWalletWrapper.key.toString(),
        });
        history.push(`/wallets/${smartWalletWrapper.key.toString()}`);
      } catch (e) {
        handleException(e, {
          source: "create-multisig",
        });
      }
    },
  });

  const keypair = useKeypair(formik.values.baseKP);
  const walletKey = useSmartWalletAddress(keypair?.publicKey);

  return (
    <div tw="grid gap-12 w-full max-w-sm mx-auto">
      <div>
        <div tw="mb-8">
          <h1 tw="font-bold text-3xl mb-4">Let's create a wallet</h1>
          <h2 tw="text-secondary font-medium text-sm">
            Goki Smart Wallet is a secure multisig wallet for managing funds and
            admin privileges.
          </h2>
        </div>
        <div tw="">
          <form tw="grid grid-cols-1 gap-6" onSubmit={formik.handleSubmit}>
            <label htmlFor="nextOwner">
              <span>Owners</span>
              {formik.values.owners.length > 1 && (
                <div>
                  {formik.values.owners.slice(0, -1).map((owner, i) => (
                    <div key={owner} tw="flex items-center justify-between">
                      <span>
                        <AddressLink address={new PublicKey(owner)} showCopy />
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextOwners = formik.values.owners.slice();
                          nextOwners.splice(i, 1);
                          void formik.setFieldValue("owners", nextOwners);
                        }}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div tw="flex gap-1">
                <InputText
                  id="nextOwner"
                  name="nextOwner"
                  type="text"
                  tw="mt-1 w-full"
                  placeholder="Enter an address"
                  onChange={(e) => {
                    void formik.setFieldValue("owners", [
                      ...formik.values.owners.slice(0, -1),
                      e.target.value,
                    ]);
                  }}
                  onBlur={() => {
                    void formik.setFieldTouched("owners");
                  }}
                  value={
                    formik.values.owners[formik.values.owners.length - 1] ?? ""
                  }
                />
                <Button
                  type="button"
                  disabled={
                    !formik.values.owners[formik.values.owners.length - 1]
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const last =
                      formik.values.owners[formik.values.owners.length - 1];
                    invariant(last, "last");
                    try {
                      new PublicKey(last);
                      void formik.setFieldValue("owners", [
                        ...formik.values.owners,
                        "",
                      ]);
                    } catch (e) {
                      void formik.setFieldTouched("owners", true);
                    }
                  }}
                  tw="mt-1"
                  variant="muted"
                >
                  <FaPlus />
                </Button>
              </div>
              {formik.touched.owners && formik.errors.owners && (
                <div tw="text-red-500 text-sm mt-2">{formik.errors.owners}</div>
              )}
            </label>
            <label>
              <div tw="flex items-center gap-2">
                <span>Minimum Signer Threshold</span>
                <MouseoverTooltip
                  text={
                    <div tw="max-w-sm">
                      <p>
                        The minimum number of signers required to execute a
                        transaction.
                      </p>
                    </div>
                  }
                  placement="bottom-start"
                >
                  <FaQuestionCircle tw="h-3 cursor-pointer" />
                </MouseoverTooltip>
              </div>
              <InputText
                name="threshold"
                type="number"
                inputMode="numeric"
                tw="mt-1 w-full"
                placeholder="Enter an integer"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.threshold}
              />
              {formik.touched.threshold && formik.errors.threshold && (
                <div tw="text-red-500 text-sm mt-2">
                  {formik.errors.threshold}
                </div>
              )}
            </label>
            <label>
              <div tw="flex items-center gap-2">
                <span>Maximum number of signers</span>
                <MouseoverTooltip
                  text={
                    <div tw="max-w-sm">
                      <p>
                        The maximum number of signers that can ever be
                        registered in this wallet.
                      </p>
                      <small>
                        Solana accounts have a fixed size, so this number must
                        be known ahead of time.
                      </small>
                    </div>
                  }
                  placement="bottom-start"
                >
                  <FaQuestionCircle tw="h-3 cursor-pointer" />
                </MouseoverTooltip>
              </div>
              <InputText
                name="maxOwners"
                type="number"
                inputMode="numeric"
                tw="mt-1 w-full"
                placeholder="Enter an integer"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.maxOwners}
              />
              {formik.touched.maxOwners && formik.errors.maxOwners && (
                <div tw="text-red-500 text-sm mt-2">
                  {formik.errors.maxOwners}
                </div>
              )}
            </label>
            <label>
              <div tw="flex items-center gap-2">
                <span>Base Keypair JSON</span>
                <MouseoverTooltip
                  text={
                    <div tw="max-w-sm">
                      <p>
                        The JSON secret key to use as the base for the Multisig
                        wallet. Use this to create a wallet with a deterministic
                        address across multiple chains.
                      </p>
                    </div>
                  }
                  placement="bottom-start"
                >
                  <FaQuestionCircle tw="h-3 cursor-pointer" />
                </MouseoverTooltip>
              </div>
              <Textarea
                name="baseKP"
                tw="mt-1 block w-full h-24"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.baseKP}
              />
              {formik.touched.baseKP && formik.errors.baseKP && (
                <div tw="text-red-500 text-sm mt-2">{formik.errors.baseKP}</div>
              )}
            </label>
            <label>
              <div tw="flex items-center gap-2">
                <span>Timelock Delay (optional)</span>
                <MouseoverTooltip
                  text={
                    <div tw="max-w-sm">
                      <p>
                        The minimum duration to wait between the time an
                        instruction is scheduled and the time an instruction can
                        be executed.
                      </p>
                    </div>
                  }
                  placement="bottom-start"
                >
                  <FaQuestionCircle tw="h-3 cursor-pointer" />
                </MouseoverTooltip>
              </div>
              <InputText
                name="delay"
                type="number"
                inputMode="numeric"
                tw="mt-1 w-full"
                placeholder="Delay (seconds)"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.delay}
              />
              {formik.touched.delay && formik.errors.delay && (
                <div tw="text-red-500 text-sm mt-2">{formik.errors.delay}</div>
              )}
            </label>
            <div tw="rounded p-4 border">
              <h3 tw="mb-4 uppercase text-secondary text-sm">Details</h3>
              <AttributeList
                attributes={{
                  "Wallet Address": walletKey.data ? walletKey.data : "--",
                }}
              />
            </div>
            <div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={formik.isSubmitting || !formik.isValid}
              >
                Create Wallet
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
