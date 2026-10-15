const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/app.js',

  output: {
    filename: 'pedigree.min.js',
    path: path.resolve(__dirname, 'dist'),
  },

  externals: [
    'XWiki', // XWiki JS library
    'Class', // PrototypeJS
    'Prototype',
    '$$',
    '$',
    '$F',
  ],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [{
         loader: 'file-loader',
         options: {
           outputPath: 'assets',
           publicPath: 'assets',
         }
       }]
      }
    ]
  },

  devServer: {
    contentBase: path.join(__dirname, '.'),
    port: 9000
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: {
            reserved: ['$super'],
          },
        },
      }),
    ],
  },

  plugins: [
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('AutoCopyMinJsPlugin', (compilation) => {
          const fs = require('fs');
          const path = require('path');
          const distFile = path.resolve(__dirname, 'dist', 'pedigree.min.js');
          const targetFile = path.resolve(__dirname, 'pedigree.min.js');
          if (fs.existsSync(distFile)) {
            fs.copyFileSync(distFile, targetFile);
            console.log('\n[AutoCopyMinJsPlugin] Successfully copied dist/pedigree.min.js -> ./pedigree.min.js');
          }
          const distAssets = path.resolve(__dirname, 'dist', 'assets');
          const targetAssets = path.resolve(__dirname, 'assets');
          if (fs.existsSync(distAssets)) {
            if (!fs.existsSync(targetAssets)) fs.mkdirSync(targetAssets, { recursive: true });
            for (const file of fs.readdirSync(distAssets)) {
              fs.copyFileSync(path.join(distAssets, file), path.join(targetAssets, file));
            }
          }
        });
      }
    }
  ],

  resolve: {
  	alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
  	}
  }
};
