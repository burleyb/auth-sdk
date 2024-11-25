import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
import awsUtil from "../lib/provider-chain/aws-util";
chai.use(sinonchai);
describe('lib/aws-util', function () {
	it("gets the current time", () => {
		let now = Date.now();
		let date = awsUtil.date.getDate();
		assert(date instanceof Date)
		assert(date.valueOf() - now < 500)
	});

	it("Creates an error", () => {
		let e1 = awsUtil.error(new Error(), "Just Message");
		let e2 = awsUtil.error(new Error(""), "Just Message 2");
		let e3 = awsUtil.error(new Error("Stuff"), "String opts");
		let e4 = awsUtil.error(new Error("Stuff2"), { message: "The message" });
		let e5 = awsUtil.error(new Error("Stuff3"), undefined);
		let e6 = awsUtil.error(new Error("Stuff4"), { code: "MY_CODE" });
		let e7 = awsUtil.error(new Error("Stuff5"), { name: "MY_NAME" });
		let e8 = awsUtil.error(new Error("Stuff6"), { stack: "MY_STACK" });

		let ignoreKeys = new Set(["stack", "time"]);
		assert.deepEqual(errorToJson(e1, ignoreKeys), { name: "Error", message: "Just Message" });
		assert.deepEqual(errorToJson(e2, ignoreKeys), { name: "Error", message: "Just Message 2" });
		assert.deepEqual(errorToJson(e3, ignoreKeys), { name: "Error", message: "String opts", originalError: { message: "Stuff" } });
		assert.deepEqual(errorToJson(e4, ignoreKeys), { name: "Error", message: "The message", originalError: { message: "Stuff2" } });
		assert.deepEqual(errorToJson(e5, ignoreKeys), { name: "Error", message: "Stuff3" });
		assert.deepEqual(errorToJson(e6, ignoreKeys), { name: "MY_CODE", code: "MY_CODE", message: "Stuff4" });
		assert.deepEqual(errorToJson(e7, ignoreKeys), { name: "MY_NAME", code: "MY_NAME", message: "Stuff5" });
		assert.deepEqual(errorToJson(e8, new Set(["time"])), { name: "Error", message: "Stuff6", stack: "MY_STACK" });
	})
});

function errorToJson(err?: Error, ignoreKeys = new Set()): any {
	if (err) {
		return Object.getOwnPropertyNames(err).reduce((ne, k) => {
			if (!ignoreKeys.has(k)) {
				ne[k] = err[k];
			}
			return ne;
		}, {})
	} else {
		return err;
	}

}
