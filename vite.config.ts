import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import '@esbuild-plugins/node-modules-polyfill';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'REACT_APP__');

  const htmlPlugin = () => {
    return {
      name: 'html-transform',
      transformIndexHtml(html: string) {
        return html.replace(/%(.*?)%/g, function (_, p1) {
          return env[p1] || '';
        });
      },
    };
  };
  return {
    envPrefix: 'REACT_APP_',
    resolve: {
      alias: {
        // fix Node JS in browser dependencies from BigNumber
        // see: https://gist.github.com/FbN/0e651105937c8000f10fefdf9ec9af3d
        events: 'rollup-plugin-node-polyfills/polyfills/events',
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        // add Node.js global to browser globalThis
        define: {
          global: 'globalThis',
        },
        // Enable esbuild polyfill plugins
        plugins: [
          NodeGlobalsPolyfillPlugin({
            buffer: true,
          }),
          // todo: remove when issue is fixed:
          //    - see https://github.com/remorses/esbuild-plugins/issues/24#issuecomment-1369928859
          // workaround for Vite v4 plugins error:
          //    "The injected path "..." cannot be marked as external"
          {
            name: 'fix-node-globals-polyfill',
            setup(build) {
              build.onResolve(
                { filter: /_virtual-process-polyfill_\.js/ },
                ({ path }) => ({ path })
              );
            },
          },
        ],
      },
    },
    plugins: [htmlPlugin(), react()],
    test: {
      environment: 'jsdom',
    },
  };
});
