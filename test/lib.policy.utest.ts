import sinon from "sinon";
import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
chai.use(sinonchai);

import policy from "../lib/policy"




describe('lib/policy', function () {
	it("contextifies", () => {

		let r = policy.contextify({
			top: {
				nested_value: "v1"
			},
			next: 123,
			get: () => "abc",
			array: ["one", "two"]
		}, [{
			data: "policy-${top.nested_value}-${next}-${get}",
			other: "thing-${array}"
		}].map(v => JSON.stringify(v)));

		assert.deepEqual(r, [{
			data: "policy-v1-123-abc",
			other: "thing-one,two"
		}])
	});

	it("contextifies - no var", () => {

		let error;
		try {
			let r = policy.contextify({
				next: 123,
				get: () => "abc",
				array: ["one", "two"]
			}, [{
				data: "policy-${top.nested_value}-${next}-${get}",
				other: "thing-${array}"
			}].map(v => JSON.stringify(v)));
		} catch (err) {
			error = err;
		}
		if (error) {
			assert.equal(error.message, "Unknown variable top.nested_value");
		} else {
			assert.fail("Should have thrown an error");
		}
	});

	it("validate", () => {

		let r = policy.validate({}, [])

		assert.deepEqual(r, {
			auth: false,
			reason: "Did not match any statements"
		})
	});

	it("validate - empty", () => {

		let r = policy.validate({}, [{
			Effect: "Allow",
			Action: "Get:*",
			Resource: "*"
		}, {
			Effect: "Deny",
			Action: "Get:*",
			Resource: "*"
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "Did not match any statements"
		})
	});
	it("validate - empty resource", () => {

		let r = policy.validate({
			action: "Get:123"
		}, [{
			Effect: "Allow",
			Action: "Get:*",
			Resource: "*"
		}, {
			Effect: "Deny",
			Action: "Get:*",
			Resource: "*"
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "Did not match any statements"
		})
	});

	it("validate - allow", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234"
		}, [{
			Effect: "Allow",
			Action: "Get:*",
			Resource: "*"
		}])

		assert.deepEqual(r, {
			auth: true,
			reason: "Matched policy"
		})
	});

	it("validate - allow condition", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234",
			"my:source-ip": "192.168.0.0"
		}, [{
			Effect: "Allow",
			Action: "Get:*",
			Resource: "*",
			Condition: {
				IpAddress: {
					"my:source-ip": ["192.168.0.0"]
				}
			}
		}])

		assert.deepEqual(r, {
			auth: true,
			reason: "Matched policy"
		})
	});

	it("validate - allow condition fail", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234",
			"my:source-ip": "192.168.0.1"
		}, [{
			Effect: "Allow",
			Action: "Get:*",
			Resource: "*",
			Condition: {
				IpAddress: {
					"my:source-ip": ["192.168.0.0"]
				}
			}
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "Did not match any statements"
		})
	});

	it("validate - allow NotResource", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234"
		}, [{
			Effect: "Allow",
			NotAction: "Leave",
			NotResource: "asdfasdf:asdfsadf"
		}])

		assert.deepEqual(r, {
			auth: true,
			reason: "Matched policy"
		})
	});

	it("validate - deny", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234"
		}, [{
			Effect: "Deny",
			Action: "Get:*",
			Resource: "*"
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "denied by policy"
		})
	});

	it("validate - deny condition", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234",
			"my:source-ip": "192.168.0.0"
		}, [{
			Effect: "Deny",
			Action: "Get:*",
			Resource: "*",
			Condition: {
				IpAddress: {
					"my:source-ip": ["192.168.0.0"]
				}
			}
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "denied by policy"
		})
	});

	it("validate - deny condition fail", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234",
			"my:source-ip": "192.168.0.1"
		}, [{
			Effect: "Deny",
			Action: "Get:*",
			Resource: "*",
			Condition: {
				IpAddress: {
					"my:source-ip": ["192.168.0.0"]
				}
			}
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "Did not match any statements"
		})
	});

	it("validate - deny NotResource", () => {

		let r = policy.validate({
			action: "Get:234",
			lrn: "some:lrn:thing:::234"
		}, [{
			Effect: "Deny",
			NotAction: "Leave",
			NotResource: "asdfasdf:asdfsadf"
		}])

		assert.deepEqual(r, {
			auth: false,
			reason: "denied by policy"
		})
	});
});
