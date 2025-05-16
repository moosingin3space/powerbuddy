import { setup } from "xstate";

/**
 * This module defines the core state machine for a lamp.
 */

export function createLampMachine({
  meraki_api,
  isAfterSunset,
  isLateNight
}: {
  meraki_api: (params: { power: boolean }) => void;
  isAfterSunset: () => boolean;
  isLateNight: () => boolean;
}) {
  return setup({
    types: {
      context: {} as {},
      events: {} as
        | { type: "leave" }
        | { type: "quiet" }
        | { type: "time_check" }
        | { type: "arrive" }
        | { type: "loud" }
        | { type: "manual_override_off" }
        | { type: "manual_override_on" },
    },
    actions: {
      meraki_api: (_, params) => meraki_api(params),
    },
    guards: {
      isAfterSunset: () => isAfterSunset(),
      isLateNight: () => isLateNight(),
    },
  }).createMachine({
    context: {},
    id: "lamp",
    initial: "Off",
    states: {
      Off: {
        on: {
          arrive: {
            target: "On",
            actions: {
              type: "meraki_api",
              params: {
                power: true,
              },
            },
            guard: {
              type: "isAfterSunset",
            },
          },
          loud: {
            target: "On",
            actions: {
              type: "meraki_api",
              params: {
                power: false,
              },
            },
            guard: {
              type: "isAfterSunset",
            },
          },
          manual_override_on: {
            target: "On",
            actions: {
              type: "meraki_api",
              params: {
                power: true,
              },
            },
          },
        },
      },
      On: {
        on: {
          leave: {
            target: "Off",
            actions: {
              type: "meraki_api",
              params: {
                power: false,
              },
            },
          },
          quiet: {
            target: "Off",
            actions: {
              type: "meraki_api",
              params: {
                power: false,
              },
            },
          },
          manual_override_off: {
            target: "Off",
            actions: {
              type: "meraki_api",
              params: {
                power: false,
              },
            },
          },
          time_check: {
            target: "Off",
            actions: {
              type: "meraki_api",
              params: {
                power: false,
              },
            },
            guard: {
              type: "isLateNight",
            },
          },
        },
      },
    },
  });
}
