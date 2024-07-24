import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
import sinon from "sinon";
import awsUtil from "../lib/provider-chain/aws-util";
import { AWSSecretsConfiguration, ConfigProviderChain, EnvironmentConfiguration, FileTreeConfiguration, GenericConfiguration, ObjectConfiguration, ProvidersInputType } from "../lib/provider-chain";
import Configuration from "../lib/provider-chain/configuration";
import awsSdkSync from "../lib/provider-chain/aws-sdk-sync";
chai.use(sinonchai);

interface MyType {
	value: number
}
class MyConfig extends Configuration<MyType> {
	constructor(private value: number | number[]) {
		super();
	}
	refresh() {
		this.expired = false;
		let value = typeof this.value === "number" ? this.value : this.value.shift();
		this.update({ value });
	}
}

describe('lib/provider-chain/index', function () {
	describe("Create", () => {
		it("creates chain", () => {
			let c = new ConfigProviderChain("UTEST", [new MyConfig(100)]);
			assert.deepEqual(c, {
				"data": undefined,
				"expireTime": 0,
				"expired": false,
				"expiryWindow": 15,
				"prefix": "UTEST",
				"providers": [
					{
						"data": undefined, "expireTime": 0, "expired": false, "expiryWindow": 15, "value": 100
					}
				]
			});

			assert.deepEqual(c.resolve(), {
				value: 100
			});
		});

		it("creates chain - append", () => {
			let c = new ConfigProviderChain("UTEST", [new MyConfig(101)], ProvidersInputType.Append);
			assert.deepEqual(c.providers.length, 9);

			assert.deepEqual(c.resolve(), {
				value: 101
			});
		});
		it("creates chain - prepend", () => {
			let c = new ConfigProviderChain("UTEST", [new MyConfig(102)], ProvidersInputType.Prepend);
			assert.deepEqual(c.providers.length, 9);
			assert.deepEqual(c.resolve(), {
				value: 102
			});
		});
	});
	let envVars = ["LEOAUTH"];
	let keys = [
		"LeoAuthUser",
		"LeoAuth"
	];

	let sandbox;
	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});
	afterEach(() => {
		sandbox.restore();
		envVars.forEach(field => {
			delete process.env[field];
			delete process[field];
			delete global[field];
			keys.forEach(key => {
				delete process.env[`${field}_${key}`];
			});
		});

		delete process.env.LEO_ENVIRONMENT;
		delete require("leo-config").leoauth;
		delete global.leoauth;
	});
	after(() => {
		delete require[require.resolve("leo-config")];
	});
	describe("Chain", function () {
		it('throws and error', async function () {

			let gotError;
			try {
				let chain = new ConfigProviderChain("leoauth");
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = true;
			}
			assert(gotError, "should have thrown an error");
		});

		it('throws no providers error', async function () {

			let gotError;
			try {
				let chain = new ConfigProviderChain("leoauth", []);
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "No providers");
		});
		it('read object', async function () {
			let mockSdkConfig: any = {
				LeoAuth: "mock-LeoAuth",
				LeoAuthUser: "mock-LeoAuthUser"
			};
			let gotError;
			let config;
			try {
				let chain = new ConfigProviderChain("leoauth", mockSdkConfig);
				config = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig);
		});


		it('read object prepend', async function () {
			let mockSdkConfig1: any = {
				LeoAuth: "mock7-LeoAuth",
				LeoAuthUser: "mock7-LeoAuthUser"
			};
			let mockSdkConfig2: any = {
				LeoAuth: "mock6-LeoAuth",
				LeoAuthUser: "mock6-LeoAuthUser"
			};
			process.env.LEOAUTH = JSON.stringify(mockSdkConfig2);
			let gotError;
			let config;
			try {
				let chain = new ConfigProviderChain("leoauth", mockSdkConfig1, ProvidersInputType.Prepend);
				config = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig1);
		});

		it('read object append', async function () {
			let mockSdkConfig1: any = {
				LeoAuth: "mock8-LeoAuth",
				LeoAuthUser: "mock8-LeoAuthUser"
			};
			let mockSdkConfig2: any = {
				LeoAuth: "mock9-LeoAuth",
				LeoAuthUser: "mock9-LeoAuthUser"
			};
			process.env.LEOAUTH = JSON.stringify(mockSdkConfig2);
			let gotError;
			let config;
			try {
				let chain = new ConfigProviderChain("leoauth", mockSdkConfig1, ProvidersInputType.Append);
				config = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig2);
		});
	});


	describe("Config", function () {
		it('read no refresh', async function () {
			let mockSdkConfig: any = {
				LeoAuth: "mock-LeoAuth",
				LeoAuthUser: "mock-LeoAuthUser"
			};
			let gotError;
			let config1;
			let config2;
			let refresh = true;
			process.env.LEOAUTH = JSON.stringify(mockSdkConfig);
			try {
				let chain = new EnvironmentConfiguration("LEOAUTH");
				config1 = chain.resolve();
				refresh = chain.needsRefresh();
				config2 = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert(!refresh, "Shouldn't need refresh");
			assert.deepEqual(justKeyFields(config1), mockSdkConfig);
			assert.deepEqual(justKeyFields(config2), mockSdkConfig);
		});
	});
	describe("ENV", function () {

		it('throws unparsable env error', async function () {

			let gotError;
			process.env.LEOAUTH = '{"hello":2]';
			try {
				let chain = new EnvironmentConfiguration("LEOAUTH");
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Unable to parse env variable: LEOAUTH");
		});

		it('read env var', async function () {
			let mockSdkConfig = {
				LeoAuth: "mock1-LeoAuth",
				LeoAuthUser: "mock1-LeoAuthUser"
			};
			let gotError;
			let config;
			process.env.LEOAUTH = JSON.stringify(mockSdkConfig);
			try {
				let chain = new ConfigProviderChain("leoauth");
				config = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig);
		});
	});
	describe("Tree", function () {
		it('throws tree error', async function () {

			let gotError;
			try {
				let chain = new FileTreeConfiguration(".", ["hello.world"]);
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Unable to find file config");
		});
	});
	// describe("leo-config", function () {
	// 	it('Get from leo-config', async function () {

	// 		let gotError;
	// 		let mockSdkConfig: any = {
	// 			LeoAuth: "mock4-LeoAuth",
	// 			LeoAuthUser: "mock4-LeoAuthUser"
	// 		};
	// 		require("leo-config").bootstrap({
	// 			_global: {
	// 				leosdk: mockSdkConfig
	// 			}
	// 		});

	// 		let config;
	// 		try {
	// 			let chain = new LeoConfiguration();
	// 			config = chain.resolve();
	// 		} catch (err) {
	// 			gotError = err;
	// 		}
	// 		assert(!gotError, "should not have thrown an error");
	// 		assert.deepEqual(justKeyFields(config), mockSdkConfig);
	// 	});

	// 	it('throws leo-config error', async function () {

	// 		let gotError;
	// 		try {
	// 			let chain = new LeoConfiguration();
	// 			chain.resolve();
	// 			assert.fail("Should throw an error");
	// 		} catch (err) {
	// 			gotError = err;
	// 		}
	// 		assert(!!gotError, "should have thrown an error");
	// 		assert(gotError.message.match(/^Unable to get config from leo-config env/), gotError.message);
	// 	});
	// });
	describe("Object", function () {
		it('throws no root error', async function () {

			let gotError;

			let config;
			try {
				let chain = new ObjectConfiguration(null, "");
				config = chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Root and Field must be specified.");

		});
		it('throws no field error', async function () {

			let gotError;

			let config;
			try {
				let chain = new ObjectConfiguration({}, "");
				config = chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Root and Field must be specified.");

		});

		it('throws no config in object', async function () {
			let gotError;
			try {
				let chain = new ObjectConfiguration({}, "LEOAUTH");
				chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should not have thrown an error");
			assert.equal(gotError.message, "Unable to get config from LEOAUTH");
		});

		it('gets config object', async function () {
			let gotError;
			let mockSdkConfig = {
				LeoAuth: "mock5-LeoAuth",
				LeoAuthUser: "mock5-leoAuthUser"
			};

			let config;
			try {
				let chain = new ObjectConfiguration({ LEOAUTH: mockSdkConfig }, "LEOAUTH");
				config = chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig);
		});
	});
	describe("Generic", function () {

		it('throws no config', async function () {
			let gotError;
			try {
				let chain = new GenericConfiguration<any>(() => {
					throw new Error("No config")
				});
				chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "No config");
		});

		it('gets config object', async function () {
			let gotError;
			let mockSdkConfig = {
				LeoAuth: "mock5-LeoAuth",
				LeoAuthUser: "mock5-leoAuthUser"
			};

			let config;
			try {
				let chain = new GenericConfiguration<any>(() => {
					return mockSdkConfig
				});
				config = chain.resolve();
			} catch (err) {
				gotError = err;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig);
		});
	});
	describe("Secrets Manager", function () {

		function AWSRequest(response) {
			return {
				promise: async () => {
					if (response instanceof Error) {
						throw response;
					}
					return response;
				}
			};
		}

		beforeEach(() => {
			AWSSecretsConfiguration.clearCache();
		});

		it('throws env not set error', async function () {

			let gotError;
			try {
				delete process.env.rstreams_secret;
				let chain = new AWSSecretsConfiguration("rstreams_secret");
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Secret not specified.  Use ENV var rstreams_secret.");
		});

		it('throws not found error', async function () {

			let gotError;
			process.env.rstreams_secret = 'mock-secret';
			let getSecretValue = sandbox.stub().throws(new Error("Not found"));
			sandbox.stub(awsSdkSync, 'SecretsManager').returns({ getSecretValue });
			try {
				let chain = new AWSSecretsConfiguration("rstreams_secret");
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Secret 'mock-secret' not available. Error: Not found");
		});

		it('throws not parsable error', async function () {

			let gotError;
			process.env.rstreams_secret = 'mock-secret';
			let getSecretValue = sandbox.stub().returns({ SecretString: "{]" });
			sandbox.stub(awsSdkSync, 'SecretsManager').returns({ getSecretValue });
			try {
				let chain = new AWSSecretsConfiguration("rstreams_secret");
				chain.resolve();
				assert.fail("Should throw an error");
			} catch (err) {
				gotError = err;
			}
			assert(!!gotError, "should have thrown an error");
			assert.equal(gotError.message, "Unable to parse secret 'mock-secret'.");
		});

		it('read Secret Config', async function () {
			let mockSdkConfig = {
				LeoAuth: "mock10-LeoAuth",
				LeoAuthUser: "mock10-LeoAuthUser"
			};
			let gotError;
			let config;

			process.env.rstreams_secret = 'mock-secret';
			let getSecretValue = sandbox.stub().returns({
				SecretString: JSON.stringify(mockSdkConfig)
			});
			sandbox.stub(awsSdkSync, 'SecretsManager').returns({ getSecretValue });

			try {
				let chain = new AWSSecretsConfiguration("rstreams_secret");
				config = chain.resolve();
			} catch (err) {
				gotError = true;
			}
			assert(!gotError, "should not have thrown an error");
			assert.deepEqual(justKeyFields(config), mockSdkConfig);
		});
	});

	function justKeyFields(data = {}) {
		let result = {};
		keys.forEach(key => {
			result[key] = data[key];
		});
		return result;
	}

});

