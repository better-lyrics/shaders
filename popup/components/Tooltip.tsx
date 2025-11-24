import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);

  const { refs, floatingStyles } = useFloating({
    open: visible,
    placement: "left",
    middleware: [
      offset(8),
      flip(),
      shift({
        padding: 20,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  return (
    <>
      <div
        ref={refs.setReference}
        className="tooltip-wrapper"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="tooltip tooltip--visible"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
