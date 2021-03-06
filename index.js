const mix = require('laravel-mix');

const argv = require('yargs').argv;
const command = require('node-cmd');
const fs = require('fs');
const hasbin = require('hasbin');
const path = require('path');

const BrowserSync = require('browser-sync');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const ExtraWatchWebpackPlugin = require('extra-watch-webpack-plugin');

const { SyncHook } = require('tapable');

let browserSyncInstance;

class Jigsaw {
    /**
     * Register the component.
     */
    register(config = {}) {
        this.env = argv.env || 'local';
        this.port = argv.port || 3000;
        this.bin = this.binaryPath();

        this.config = {
            browserSync: true,
            open: true,
            online: true,
            proxy: undefined,
            watch: [
                'config.php',
                'source/**/*.md',
                'source/**/*.php',
                'source/**/*.scss',
                '!source/**/cache/*',
            ],
            browserSyncOptions: {},
            ...config,
        };
    }

    /*
     * Plugins to be merged with the master webpack config.
     */
    webpackPlugins() {
        return [
            this.jigsawPlugin(),
            this.config.browserSync ? this.browserSyncPlugin(this.config.proxy) : undefined,
            this.config.watch ? this.watchPlugin() : undefined,
        ].filter(plugin => plugin);
    }

    /**
     * Get the path to the Jigsaw binary.
     */
    binaryPath() {
        if (fs.existsSync('./vendor/bin/jigsaw')) {
            return path.normalize('./vendor/bin/jigsaw');
        }

        if (hasbin.sync('jigsaw')) {
            return 'jigsaw';
        }

        console.error('Could not find Jigsaw; please install it via Composer.');
        process.exit();
    }

    /**
     * Get the Jigsaw webpack plugin, to build the Jigsaw site and reload BrowserSync.
     */
    jigsawPlugin(compiler) {
        let { bin, env } = { bin: this.bin, env: this.env };

        return new class {
            apply(compiler) {
                compiler.hooks.jigsawDone = new SyncHook([]);

                compiler.hooks.done.tap('Jigsaw Webpack Plugin', () => {
                    return command.get(`${bin} build -q ${env}`, (error, stdout, stderr) => {
                        console.log(error ? stderr : stdout);

                        if (browserSyncInstance) {
                            browserSyncInstance.reload();
                        }

                        compiler.hooks.jigsawDone.call();
                    });
                });
            }
        };
    }

    /**
     * Get and instance of the ExtraWatchWebpackPlugin.
     */
    watchPlugin() {
        return new ExtraWatchWebpackPlugin({
            files: this.config.watch,
        });
    }

    /**
     * Get an instance of the BrowserSyncPlugin.
     */
    browserSyncPlugin(proxy) {
        return new BrowserSyncPlugin({
            notify: false,
            open: this.config.open,
            online: this.config.online,
            port: this.port,
            proxy: proxy,
            server: proxy ? null : { baseDir: 'build_' + this.env + '/' },
            ...this.config.browserSyncOptions,
        }, {
            reload: false,
            callback: () => browserSyncInstance = BrowserSync.get('bs-webpack-plugin'),
        });
    }
}

mix.extend('jigsaw', new Jigsaw());
