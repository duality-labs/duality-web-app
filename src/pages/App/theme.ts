import { extendTheme, ThemeConfig } from '@chakra-ui/react';
import { GlobalStyles } from '@chakra-ui/theme-tools';
import type { StyleFunctionProps } from '@chakra-ui/styled-system';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: true,
};

const styles: GlobalStyles = {
  global: (props: StyleFunctionProps) => ({
    body: {
      bg:
        props.colorMode === 'dark'
          ? 'fixed #fff conic-gradient(from 120deg at 50% 100%, rgb(78, 177, 232) 0deg, rgba(18, 92, 135, 0.8) 180deg, rgba(0, 0, 0, 0.8) 360deg)'
          : 'fixed #fff conic-gradient(from 120deg at 50% 100%, rgb(78, 177, 232) 0deg, rgba(78, 177, 232, 0.8) 180deg, rgba(255, 255, 255, 0.8) 360deg)',
    },
  }),
};

const theme = extendTheme({ config, styles });

export default theme;
