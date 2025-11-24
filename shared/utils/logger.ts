const PREFIX = "[BLS]";

let isEnabled = true;

export const logger = {
  log: (...args: any[]) => {
    if (isEnabled) {
      console.log(PREFIX, ...args);
    }
  },

  info: (...args: any[]) => {
    if (isEnabled) {
      console.info(PREFIX, ...args);
    }
  },

  warn: (...args: any[]) => {
    if (isEnabled) {
      console.warn(PREFIX, ...args);
    }
  },

  error: (...args: any[]) => {
    console.error(PREFIX, ...args);
  },

  setEnabled: (enabled: boolean) => {
    isEnabled = enabled;
  },

  isEnabled: () => isEnabled,
};
