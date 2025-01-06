/* eslint-disable no-negated-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */

import util from './aws-util';
import Configuration from './configuration';
import * as fs from 'fs';
import * as path from 'path';
import awsSdkSync from './aws-sdk-sync';

declare let __webpack_require__: unknown;
declare let __non_webpack_require__: unknown;
const requireFn: (pkg: string) => unknown = (
    typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require
) as (pkg: string) => unknown;

export enum ProvidersInputType {
    Replace,
    Prepend,
    Append,
}

/**
 * The [Configuring RStreams](rstreams-site-url/rstreams-flow/configuring-rstreams)
 * guide might be helpful.
 *
 * Creates a configuration provider chain that searches for RStreams configurations
 * in a list of configuration providers specified by the {providers} property.
 *
 * By default, the chain will use the {defaultProviders} to resolve configurations.
 * These providers will look in the environment using the
 * {RStreams.EnvironmentConfiguration} class with the 'LEO' and 'RSTREAMS' prefixes.
 *
 * ## Setting Providers
 *
 * Each provider in the {providers} list should be a function that returns
 * a {RStreams.Configuration} object, or a hardcoded Configuration object. The function
 * form allows for delayed execution of the credential construction.
 *
 * ## Resolving Configurations from a Chain
 *
 * Call {resolve} to return the first valid credential object that can be
 * loaded by the provider chain.
 *
 * For example, to resolve a chain with a custom provider that checks a file
 * on disk after the set of {defaultProviders}:
 *
 * ```javascript
 * let envProvider = new RStreams.EnvironmentConfiguration('MyEnvVar');
 * let chain = new RStreams.ConfigProviderChain([envProvider], ProvidersInputType.Append);
 * chain.resolve();
 * ```
 *
 * The above code will return the `envProvider` object if the
 * env contains configuration and the `defaultProviders` do not contain
 * any configuration settings.
 *
 * @!attribute providers
 *   @return [Array<RStreams.Configuration, Function>]
 *     a list of configuration objects or functions that return configuration
 *     objects. If the provider is a function, the function will be
 *     executed lazily when the provider needs to be checked for valid
 *     configuration. By default, this object will be set to the
 *     {defaultProviders}.
 *   @see defaultProviders
 */

export type Provider<T> = (() => Configuration<T>) | Configuration<T>;

export class ConfigProviderChain<T> extends Configuration<T> {
    providers: Provider<T>[];
    prefix: string;
    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(
        prefix: string,
        providers?: Provider<T> | Provider<T>[],
        addToDefaults: ProvidersInputType = ProvidersInputType.Replace,
    ) {
        super();
        this.prefix = prefix;
        if (providers && addToDefaults === ProvidersInputType.Replace) {
            this.providers = ([] as Provider<T>[]).concat(providers);
        } else {
            this.providers = this.getDefaultProviders();
            if (providers && addToDefaults === ProvidersInputType.Prepend) {
                this.providers = ([] as Provider<T>[]).concat(providers, this.providers);
            } else if (providers && addToDefaults === ProvidersInputType.Append) {
                this.providers = this.providers.concat(providers);
            }
        }
    }

    getDefaultProviders(): Provider<T>[] {
        const prefix: string = this.prefix;
        const defaultProviders: Provider<T>[] = [
            /* Env locations */
            function () {
                return new EnvironmentConfiguration<T>(prefix);
            },
            function () {
                return new EnvironmentConfiguration<T>(prefix.toUpperCase(), new Set(["CONFIG_SECRET"]));
            },
            function () {
                return new EnvironmentConfiguration<T>(prefix.toLowerCase(), new Set(["config_secret"]));
            },

            /* process Object locations */
            function () {
                return new ObjectConfiguration<T>(process, prefix);
            },

            // global Object locations
            function () {
                return new ObjectConfiguration<T>(global, prefix);
            },

            /* File tree locations */
            function () {
                return new FileTreeConfiguration<T>(process.cwd(), [
                    `${prefix}.config.json`,
                    `${prefix}.config.js`,
                    `${prefix}config.json`,
                    `${prefix}config.js`,

                    `config/${prefix}.config.json`,
                    `config/${prefix}.config.js`,
                    `config/${prefix}config.json`,
                    `config/${prefix}config.js`,
                ]);
            },

            /* AWS Secrets locations */
            function () {
                return new AWSSecretsConfiguration(`${prefix}_CONFIG_SECRET`.toLowerCase());
            },
            function () {
                return new AWSSecretsConfiguration(`${prefix}_CONFIG_SECRET`.toUpperCase());
            },
        ];
        return defaultProviders;
    }

    /**
     * Resolves the provider chain by searching for the first set of
     * configuration in {providers}.
     *
     * @return [RStreams.Configuration] the provider, for chaining.
     */
    resolve(): T {
        if (this.providers.length === 0) {
            throw new Error('No providers');
        }

        const providers = this.providers.slice(0);

        let value: Configuration<T> | T | null = null;
        let error;
        for (const provider of providers) {
            if (typeof provider === 'function') {
                // eslint-disable-next-line no-useless-call
                value = provider.call(undefined);
            } else {
                value = provider;
            }

            try {
                if (value instanceof Configuration) {
                    return value.get() as T;
                } else {
                    return value as T;
                }
            } catch (err) {
                error = err;
            }
        }

        if (error != null) {
            throw error;
        } else if (value == null) {
            throw new Error('Config not found');
        }

        return value as T;
    }

    /**
     * The default set of providers used by a vanilla ConfigProviderChain.
     *
     * In Node.js:
     *
     * ```javascript
     * RStreams.ConfigProviderChain.defaultProviders = [
     *	function () { return new EnvironmentConfiguration('RSTREAMS_CONFIG'); },
     *	function () { return new EnvironmentConfiguration('leosdk'); },
     *	function () { return new EnvironmentConfiguration('leo-sdk'); },
     *	function () { return new EnvironmentConfiguration('LEOSDK'); },
     *	function () { return new EnvironmentConfiguration('LEO-SDK'); },
     *	function () { return new LeoConfiguration(); },
     *	function () { return new ObjectConfiguration(process, "leosdk"); },
     *	function () { return new ObjectConfiguration(process, "leo-sdk"); },
     *	function () { return new ObjectConfiguration(process, "rstreams_config"); },
     *	function () { return new ObjectConfiguration(global, "leosdk"); },
     *	function () { return new ObjectConfiguration(global, "leo-sdk"); },
     *	function () { return new ObjectConfiguration(global, "rstreams_config"); },
     *	function () {
     *		return new FileTreeConfiguration(process.cwd(), [
     *			"leo.config.json",
     *			"leo.config.js",
     *			"rstreams.config.json",
     *			"rstreams.config.js",
     *			"leoconfig.json",
     *			"leoconfig.js",
     *			"rstreamsconfig.json",
     *			"rstreamsconfig.js",
     *
     *			"config/leo.config.json",
     *			"config/leo.config.js",
     *			"config/rstreams.config.json",
     *			"config/rstreams.config.js",
     *			"config/leoconfig.json",
     *			"config/leoconfig.js",
     *			"config/rstreamsconfig.json",
     *			"config/rstreamsconfig.js",
     *		]);
     *	},
     *	function () { return new AWSSecretsConfiguration('LEO_CONFIG_SECRET'); },
     *	function () { return new AWSSecretsConfiguration('RSTREAMS_CONFIG_SECRET'); },
     *
     * ]
     * ```
     */
}

export default ConfigProviderChain;

export class EnvironmentConfiguration<T> extends Configuration<T> {
    envPrefix: string;
    exclude: Set<string>;
    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(envPrefix: string, exclude?: Set<string>) {
        super();
        this.envPrefix = envPrefix.replace(/[- ]/g, '_');
        this.exclude = exclude ?? new Set();
    }

    refresh() {
        if (!process || !process.env) {
            throw util.error(new Error(`Unable to parse environment variable: ${this.envPrefix}.`), {
                code: 'EnvironmentConfigurationProviderFailure',
            });
        }

        let values: Record<string, unknown>;
        if (process.env[this.envPrefix] != null) {
            try {
                values = JSON.parse(process.env[this.envPrefix] ?? '{}');
            } catch (err) {
                throw util.error(new Error(`Unable to parse env variable: ${this.envPrefix}`), {
                    code: 'EnvironmentConfigurationProviderFailure',
                });
            }
        } else {
            const prefix = `${this.envPrefix}_`;
            const keys = Object.keys(process.env).filter((key) => key.startsWith(prefix) && !this.exclude.has(key.replace(prefix, "")));
            if (keys.length === 0) {
                throw util.error(new Error(`Unable to parse env variable: ${this.envPrefix}`), {
                    code: 'EnvironmentConfigurationProviderFailure',
                });
            }

            const regex = new RegExp(`^${this.envPrefix}_`, 'i');
            values = keys.reduce((obj, key) => {
                (obj as Record<string, unknown>)[key.replace(regex, '')] = process.env[key];
                return obj;
            }, {});
        }

        this.expired = false;
        this.update(values as T);
        //return this;
    }
}

export class FileTreeConfiguration<T> extends Configuration<T> {
    startingDirectory: string;
    filenames: string[];

    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(startingDirectory: string, filenames: string[]) {
        super();
        this.startingDirectory = startingDirectory;
        this.filenames = Array.isArray(filenames) ? filenames : [filenames];
        //this.get(function () { });
    }

    refresh() {
        let values = null;

        let currentDir = this.startingDirectory;

        let lastDir;
        const dirs = [];
        do {
            dirs.push(currentDir);
            lastDir = currentDir;
            currentDir = path.resolve(currentDir, '../');
            // eslint-disable-next-line eqeqeq
        } while (currentDir != lastDir);

        const errors = [];
        // eslint-disable-next-line no-labels
        outer: for (const dir of dirs) {
            for (const filename of this.filenames) {
                const file = path.resolve(dir, filename);
                // eslint-disable-next-line no-sync
                if (fs.existsSync(file)) {
                    try {
                        values = requireFn(file);
                        // eslint-disable-next-line no-labels
                        break outer;
                    } catch (err) {
                        errors.push(err);
                    }
                }
            }
        }

        if (values == null) {
            throw util.error(new Error(`Unable to find file config`), {
                code: 'FileTreeConfigurationProviderFailure',
                errors,
            });
        }

        this.expired = false;
        this.update(values as T);
        return this;
    }
}

export class ObjectConfiguration<T> extends Configuration<T> {
    field: string;
    root: Record<string | number | symbol, unknown>;

    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(root: unknown, field: string) {
        super();
        this.field = field;
        this.root = root as Record<string | number | symbol, unknown>;
        //this.get(function () { });
    }

    refresh() {
        // eslint-disable-next-line eqeqeq
        if (this.root == null || this.field == null || this.field == '') {
            throw util.error(new Error(`Root and Field must be specified.`), {
                code: 'ObjectConfigurationProviderFailure',
            });
        }

        const values = this.root[this.field] ? this.root[this.field] : null;
        if (values == null) {
            throw util.error(new Error(`Unable to get config from ${this.field}`), {
                code: 'ObjectConfigurationProviderFailure',
            });
        }

        this.expired = false;
        this.update(values as T);
        return this;
    }
}

export class AWSSecretsConfiguration<T> extends Configuration<T> {
    secretEnvKey: string;
    cacheDuration: number;
    static valueCache: Record<string, { expireTime: number; data: unknown }> = {};
    public static clearCache() {
        AWSSecretsConfiguration.valueCache = {};
    }

    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(secretEnvKey: string, cacheDuration?: number) {
        super();
        this.secretEnvKey = secretEnvKey;
        this.cacheDuration = cacheDuration ?? 1000 * 60 * 60;
    }

    refresh() {
        if (!process || !process.env || !process.env[this.secretEnvKey]) {
            throw util.error(new Error(`Secret not specified.  Use ENV var ${this.secretEnvKey}.`), {
                code: 'AWSSecretsConfigurationProviderFailure',
            });
        }

        let values = null;

        const secretKey = process.env[this.secretEnvKey] ?? '';
        const region = process.env.AWS_REGION ?? 'us-east-1';

        const cacheKey = `${region}:${secretKey}`;
        const cachedValue = AWSSecretsConfiguration.valueCache[cacheKey];
        if (cachedValue != null && cachedValue.expireTime >= Date.now()) {
            values = cachedValue.data;
        } else {
            delete AWSSecretsConfiguration.valueCache[cacheKey];
        }

        if (values == null) {
            let error;
            try {
                const value = new awsSdkSync.SecretsManager({
                    region,
                }).getSecretValue({ SecretId: secretKey });

                try {
                    if ('SecretString' in value) {
                        values = JSON.parse(value.SecretString as string);
                    } else {
                        //let buff = Buffer.from(value.SecretBinary, 'base64');
                        //values = JSON.parse(buff.toString('ascii'));
                    }
                } catch (err) {
                    error = util.error(new Error(`Unable to parse secret '${secretKey}'.`), {
                        code: 'AWSSecretsConfigurationProviderFailure',
                    });
                }
            } catch (err) {
                error = util.error(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    new Error(`Secret '${secretKey}' not available. ${err}`),
                    { code: 'AWSSecretsConfigurationProviderFailure', parent: err },
                );
            }
            if (error != null) {
                throw error;
            }

            AWSSecretsConfiguration.valueCache[cacheKey] = {
                expireTime: Date.now() + this.cacheDuration,
                data: values,
            };
        }

        this.expired = false;

        this.update(values as T);
        return this;
    }
}

export class GenericConfiguration<T> extends Configuration<T> {
    /**
     * Creates a new ConfigProviderChain with a default set of providers
     * specified by {defaultProviders}.
     */
    constructor(private fn: () => T) {
        super();
    }

    refresh() {
        try {
            const values = this.fn();
            this.expired = false;
            this.update(values);
        } catch (e) {
            throw util.error(e, {
                code: 'GenericConfigurationProviderFailure',
            });
        }
        return this;
    }
}
