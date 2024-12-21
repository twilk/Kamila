const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const { DefinePlugin } = require('webpack');
const dotenv = require('dotenv');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    // Load environment variables
    const envVars = dotenv.config().parsed || {};
    
    // Create a string-safe version of env vars
    const stringifiedEnvVars = {
        'process.env': Object.keys(envVars).reduce((env, key) => {
            env[key] = JSON.stringify(envVars[key]);
            return env;
        }, {})
    };

    return {
        entry: {
            popup: './popup.js',
            background: './background.js',
            content: './content.js'
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].js'
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                }
            ]
        },
        plugins: [
            new DefinePlugin(stringifiedEnvVars)
        ],
        resolve: {
            extensions: ['.js'],
            alias: {
                '@': path.resolve(__dirname, 'src'),
                '@services': path.resolve(__dirname, 'services'),
                '@config': path.resolve(__dirname, 'config')
            }
        },
        devtool: isProduction ? false : 'source-map'
    };
}; 