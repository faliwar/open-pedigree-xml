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
        const syncLLM = () => {
          const fs = require('fs');
          const path = require('path');
          const mdPath = path.resolve(__dirname, 'LLMInstructions.md');
          const jsPath = path.resolve(__dirname, 'src', 'script', 'llmInstructionsContent.js');
          if (fs.existsSync(mdPath)) {
            const content = fs.readFileSync(mdPath, 'utf8');
            const jsContent = '/* Auto-generated from LLMInstructions.md - DO NOT EDIT DIRECTLY */\nexport const LLM_INSTRUCTIONS = ' + JSON.stringify(content) + ';\nexport default LLM_INSTRUCTIONS;\n';
            if (!fs.existsSync(jsPath) || fs.readFileSync(jsPath, 'utf8') !== jsContent) {
              fs.writeFileSync(jsPath, jsContent, 'utf8');
              console.log('\n[SyncLLMInstructions] Synced LLMInstructions.md -> src/script/llmInstructionsContent.js');
            }
          }
        };
        compiler.hooks.beforeRun.tap('SyncLLMInstructions', syncLLM);
        compiler.hooks.watchRun.tap('SyncLLMInstructions', (comp, callback) => {
          syncLLM();
          if (typeof callback === 'function') callback();
        });

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
          // Also copy LLMInstructions.md to dist
          const mdSource = path.resolve(__dirname, 'LLMInstructions.md');
          const mdDist = path.resolve(__dirname, 'dist', 'LLMInstructions.md');
          if (fs.existsSync(mdSource)) {
            fs.copyFileSync(mdSource, mdDist);
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
