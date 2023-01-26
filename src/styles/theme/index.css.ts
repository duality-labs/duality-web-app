import { createTheme, createThemeContract } from '@vanilla-extract/css';

// @function grayscale($scale) {
//     @return rgb($scale, $scale, $scale);
//   }

//   $light-white: grayscale(255);
//   $white: grayscale(230);
//   $dark-white: grayscale(217);
//   $light-gray: grayscale(187);
//   $gray: grayscale(136);
//   $dark-gray: grayscale(125);
//   $light-black: grayscale(51);
//   $black: grayscale(16);
//   $dark-black: grayscale(0);

//   $bg-lighter: rgb(187, 226, 246);
//   $bg-light: rgb(78, 177, 232);
//   $bg-dark: rgb(18, 92, 135);
//   $bg-darker: rgb(12, 61, 90);
//   $light-blue: rgb(161, 211, 242);

const lightnessShape = {
  light: '',
  regular: '',
  dark: '',
};
export const vars = createThemeContract({
  color: {
    white: lightnessShape,
    red: lightnessShape,
  },
});

const rgb = (r: number, g: number, b: number) => `rgb(${r}, ${g}, ${b})`;
const hsl = (h: number, s: number, l: number) => `hsl(${h}deg, ${s}%, ${l}%)`;

const white = {
  1: rgb(255, 255, 255),
  3: hsl(216, 12, 84),
  5: hsl(220, 9, 46),
};

const red = {
  5: hsl(0, 91, 74),
  7: hsl(0, 75, 51),
  9: hsl(0, 69, 36),
};

export const darkThemeClass = createTheme(vars, {
  color: {
    white: {
      light: white[1],
      regular: white[3],
      dark: white[5],
    },
    red: {
      light: red[5],
      regular: red[7],
      dark: red[9],
    },
  },
});

export const lightThemeClass = createTheme(vars, {
  color: {
    white: {
      light: white[5],
      regular: white[3],
      dark: white[1],
    },
    red: {
      light: red[9],
      regular: red[7],
      dark: red[5],
    },
  },
});
