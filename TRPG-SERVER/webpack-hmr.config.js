const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = function(options) {
  return {
    ...options,
    entry: options.entry,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    module: {
      rules: [
        {
          test: /.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules|src\/DB|src\/db/,
        },
      ],
    },
    mode: 'development',
    devtool: 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        src: path.resolve(__dirname, 'src'),
        '@app': path.resolve(__dirname, 'src'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@domains': path.resolve(__dirname, 'src/domains'),
        '@auth': path.resolve(__dirname, 'src/auth'),
        '@discord': path.resolve(__dirname, 'src/discord'),
        '@middleware': path.resolve(__dirname, 'src/middleware'),
      },
    },
    plugins: [
      ...options.plugins,
      new CleanWebpackPlugin(),
    ],
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'main.js',
      devtoolModuleFilenameTemplate: info => {
        const resourcePath = info.resourcePath;
        if (resourcePath.startsWith('webpack://')) {
          const withoutPrefix = resourcePath.substring('webpack://'.length);
          if (withoutPrefix.includes('/')) {
            return path.join(__dirname, 'src', withoutPrefix.substring(withoutPrefix.indexOf('/') + 1));
          }
          return path.join(__dirname, 'src', withoutPrefix);
        }
        return resourcePath;
      },
      sourceMapFilename: '[file].map',
    },
  };
}; 