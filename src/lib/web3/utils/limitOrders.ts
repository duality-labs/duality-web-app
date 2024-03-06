import { LimitOrderType } from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

// disallow UNRECOGNIZED in our forms (though valid to pass to chain)
export type AllowedLimitOrderTypeKey = keyof Omit<
  typeof LimitOrderType,
  'UNRECOGNIZED'
>;

// copy out enum as an object with checks that should break if the type changes
export const orderTypeEnum: {
  GOOD_TIL_CANCELLED: typeof LimitOrderType['GOOD_TIL_CANCELLED'];
  FILL_OR_KILL: typeof LimitOrderType['FILL_OR_KILL'];
  IMMEDIATE_OR_CANCEL: typeof LimitOrderType['IMMEDIATE_OR_CANCEL'];
  JUST_IN_TIME: typeof LimitOrderType['JUST_IN_TIME'];
  GOOD_TIL_TIME: typeof LimitOrderType['GOOD_TIL_TIME'];
  UNRECOGNIZED: typeof LimitOrderType['UNRECOGNIZED'];
} = {
  GOOD_TIL_CANCELLED: 0,
  FILL_OR_KILL: 1,
  IMMEDIATE_OR_CANCEL: 2,
  JUST_IN_TIME: 3,
  GOOD_TIL_TIME: 4,
  UNRECOGNIZED: -1,
};

export const inputOrderTypeTextMap: {
  [key in AllowedLimitOrderTypeKey]: string;
} = {
  GOOD_TIL_CANCELLED: 'Good Til Canceled',
  FILL_OR_KILL: 'Fill Or Kill',
  IMMEDIATE_OR_CANCEL: 'Immediate Or Cancel',
  JUST_IN_TIME: 'Just In Time',
  GOOD_TIL_TIME: 'Good Til Time',
};

export const orderTypeTextMap: {
  [key in keyof typeof LimitOrderType]: string;
} = {
  ...inputOrderTypeTextMap,
  UNRECOGNIZED: 'Unrecognized',
};

export const timePeriods = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
] as const;
export type TimePeriod = typeof timePeriods[number];

export const timePeriodLabels: {
  [timePeriod in TimePeriod]: string;
} = {
  seconds: 'Seconds',
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  weeks: 'Weeks',
};
