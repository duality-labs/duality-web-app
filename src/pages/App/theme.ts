import { extendTheme } from '@chakra-ui/react';
import type { StyleFunctionProps } from '@chakra-ui/styled-system';
import { Theme } from '@chakra-ui/theme';
import { PartialDeep } from 'type-fest';

const config: Theme['config'] = {
  initialColorMode: 'dark',
  useSystemColorMode: true,
};

const styles: Theme['styles'] = {
  global: (props: StyleFunctionProps) => ({
    body: {
      bg:
        props.colorMode === 'dark'
          ? 'fixed #000 conic-gradient(from 120deg at 50% 100%, rgb(78, 177, 232) 0deg, rgba(18, 92, 135, 0.8) 180deg, rgba(0, 0, 0, 0.8) 360deg)'
          : 'fixed #fff conic-gradient(from 120deg at 50% 100%, rgb(78, 177, 232) 0deg, rgba(78, 177, 232, 0.8) 180deg, rgba(255, 255, 255, 0.8) 360deg)',
    },
  }),
};

const components: PartialDeep<Theme['components']> = {
  Heading: {
    baseStyle: {
      fontWeight: 'semibold',
    },
  },
};

const theme = extendTheme({ config, styles, components });

export default theme;
