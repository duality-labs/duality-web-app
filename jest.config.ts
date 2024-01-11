import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTests.mjs'],
  transform: {
    // process `*.ts` and `*.tsx` files with `ts-jest`
    '^.+\\.tsx?$': 'babel-jest',
  },
  //   extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
  moduleNameMapper: {
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/test/__ mocks __/fileMock.mjs',
  },
};

export default config;
