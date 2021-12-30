import type { Placement } from "@popperjs/core";
import { animated, config, useTransition } from "@react-spring/web";
import React, { useState } from "react";
import { usePopper } from "react-popper";
import tw, { css, styled } from "twin.macro";

// import Drop from "./common/Drop";

const PopoverContainer = styled.div<{ show: boolean }>(({ show }) => [
  // tw`absolute left-0 top-0 border rounded shadow-md opacity-0 invisible text-sm bg-warmGray-100`,
  tw`absolute`,

  show && tw`opacity-100 visible`,
  css`
    z-index: 9997;
    transition: visibility 150ms linear, opacity 150ms linear;
  `,
]);

const Arrow = styled.div`
  width: 8px;
  height: 8px;
  z-index: 9998;

  ::before {
    position: absolute;
    width: 8px;
    height: 8px;
    z-index: 9998;

    content: "";
    transform: rotate(45deg);
  }

  &.arrow-top {
    bottom: -5px;
    ::before {
      border-top: none;
      border-left: none;
    }
  }

  &.arrow-bottom {
    top: -5px;
    ::before {
      border-bottom: none;
      border-right: none;
    }
  }

  &.arrow-left {
    right: -5px;

    ::before {
      border-bottom: none;
      border-left: none;
    }
  }

  &.arrow-right {
    left: -5px;
    ::before {
      border-right: none;
      border-top: none;
    }
  }
`;

export interface PopoverProps {
  content: React.ReactNode;
  guide?: boolean;
  show: boolean;
  children: React.ReactNode;
  placement?: Placement;
}

// TODO: impl guide lock x axis follow mouse (clubhouse style)
export const Popover: React.FC<PopoverProps> = ({
  content,
  children,
  placement = "auto",
  show,
}: PopoverProps) => {
  const [referenceElement, setReferenceElement] =
    useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [
      { name: "offset", options: { offset: [8, 8] } },
      { name: "arrow", options: { element: arrowElement } },
    ],
  });

  const transition = useTransition(show, {
    from: { scale: 0.96, opacity: 1 },
    enter: { scale: 1, opacity: 1 },
    leave: { scale: 1, opacity: 0 },
    config: { ...config.default, duration: 100 },
  });

  return (
    <>
      <div ref={setReferenceElement}>{children}</div>
      {show &&
        transition(
          (springStyles, item) =>
            item && (
              <>
                <PopoverContainer
                  show={show}
                  ref={setPopperElement}
                  style={styles.popper}
                  {...attributes.popper}
                >
                  <animated.div
                    tw="rounded shadow text-base bg-gray-200 dark:bg-warmGray-800"
                    style={springStyles}
                  >
                    {content}
                  </animated.div>
                  <Arrow
                    className={`arrow-${
                      attributes.popper?.["data-popper-placement"] ?? ""
                    }`}
                    ref={setArrowElement}
                    style={styles.arrow}
                    {...attributes.arrow}
                  />
                </PopoverContainer>
              </>
            )
        )}
    </>
  );
};