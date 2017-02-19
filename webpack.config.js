const webpack = require('webpack')
const path = require('path')

module.exports = {
  devtool: 'source-map',
  entry: {
    autocomplete: [
      path.resolve(__dirname, 'src/autocomplete.js'),
    ]
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'var',
    library: 'Autocomplete',
  },
  externals: {
    'jquery': 'jQuery',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false,
      },
      output: {
        comments: false,
      },
      sourceMap: true,
    })
  ],
  devServer: {
    contentBase: path.join(__dirname, 'demo'),
  },
}
