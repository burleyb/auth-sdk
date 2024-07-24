import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
import sinon from "sinon";
import awsUtil from "../lib/provider-chain/aws-util";
import Configuration from "../lib/provider-chain/configuration";
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

describe('lib/provider-chain/configuration', function () {
	it("creates config", () => {
		let c = new Configuration();
		assert.deepEqual(c, {
			"data": undefined,
			"expireTime": 0,
			"expired": false,
			"expiryWindow": 15,
		});
	});
	it("refresh config", () => {

		let c = new Configuration();
		c.expired = true;
		c.refresh();
		assert.deepEqual(c, {
			"data": undefined,
			"expireTime": 0,
			"expired": false,
			"expiryWindow": 15,
		});
	});
	it("resolve config", () => {
		let c = new MyConfig(7);
		let data = c.resolve();
		assert.deepEqual(data, {
			value: 7
		});
	});
	it("get config", () => {
		let c = new MyConfig(70);
		assert.deepEqual(c.get(), {
			value: 70
		});
		assert.deepEqual(c.get(), {
			value: 70
		});
	});


	it("get config - expired", () => {
		let c = new MyConfig([10, 20]);
		assert.deepEqual(c.get(), {
			value: 10
		});
		assert.deepEqual(c.get(), {
			value: 10
		});

		c.expireTime = Date.now();

		assert.deepEqual(c.get(), {
			value: 20
		});
		assert.deepEqual(c.get(), {
			value: 20
		});
	});


});

