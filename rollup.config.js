import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
// This will check all ESLinting while compiling.
// Useful because will notify if anything should be fixed.
import { eslint } from 'rollup-plugin-eslint';

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [
    eslint(),
    // CommonJS Must be before babel.
    // https://github.com/rollup/plugins/tree/master/packages/babel#using-with-rollupplugin-commonjs
    commonjs(),
    babel({
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env'],
    }),
  ],
};
