import sinon from "sinon";
import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
chai.use(sinonchai);

import conditions from "../lib/conditions";
import { flattenRequest } from "../lib/policy";





describe('lib/conditions', function () {
	it("matches ip address", () => {
		assert(conditions.IpAddress({
			a: "127.0.0.1"
		}, "a", ["127.0.0.1"]), "should match")
	});

	it("matches ip address block", () => {
		assert(conditions.IpAddress({
			a: "127.0.0.1/16"
		}, "a", ["127.0.0.2"]), "should match")
	});

	it("does not matche ip address", () => {
		assert(conditions.IpAddress({
			a: "127.0.0.1"
		}, "a", ["127.0.0.2"]), "should not match")
	});

	it("wrong field", () => {
		["StringLike", "StringNotLike", "StringEquals", "StringNotEquals", "IpAddress"].forEach((c) => {
			assert(!conditions[c]({
				a: "asdfasdf"
			}, "b", "this is *"), "should not match")
		})
	});

	it("null field", () => {
		["StringLike", "StringEquals"].forEach((c) => {
			assert(!conditions[c]({
				a: null
			}, "a", "this is *"), "should not match")
		})
	});

	it("undefined field", () => {
		["StringLike", "StringEquals"].forEach((c) => {
			assert(!conditions[c]({
				a: undefined
			}, "a", "this is *"), "should not match")
		})
	});

	it("StringLike - match", () => {
		assert(conditions.StringLike({
			a: "this is the string"
		}, "a", ["this is *"]), "should match")
	});

	it("StringLike - no match", () => {
		assert(!conditions.StringLike({
			a: "this is the string"
		}, "a", "this iss *"), "should not match")
	});

	it("StringNotLike - match", () => {
		assert(!conditions.StringNotLike({
			a: "this is the string"
		}, "a", "this is *"), "should not match")
	});

	it("StringNotLike - no match", () => {
		assert(conditions.StringNotLike({
			a: "this is the string"
		}, "a", "this iss *"), "should match")
	});


	it("StringEquals - match", () => {
		assert(conditions.StringEquals({
			a: "this is the string"
		}, "a", "this is the string"), "should match")
	});
	it("StringEquals - match number", () => {
		assert(conditions.StringEquals({
			a: 12345678
		}, "a", "12345678"), "should match")
	});

	it("StringEquals - no match", () => {
		assert(!conditions.StringEquals({
			a: "this is the string"
		}, "a", "this iss"), "should not match")
	});

	it("StringNotEquals - match", () => {
		assert(!conditions.StringNotEquals({
			a: "this is the string"
		}, "a", "this is the string"), "should not match")
	});

	it("StringNotEquals - no match", () => {
		assert(conditions.StringNotEquals({
			a: "this is the string"
		}, "a", "this iss"), "should match")
	});

	it("Null - true no match", () => {
		assert(conditions.Null({
			a: "this is the string"
		}, "b", true), "should not exists")
	});

	it("Null - true match", () => {
		assert(!conditions.Null({
			a: "this is the string"
		}, "a", true), "should exists")
	});

	it("Null - false match", () => {
		assert(conditions.Null({
			a: "this is the string"
		}, "a", false), "should exists")
	});

	it("Null - false no match", () => {
		assert(!conditions.Null({
			a: "this is the string"
		}, "b", false), "should not exists")
	});

	it("Null - false no match null", () => {
		assert(!conditions.Null({
			a: null
		}, "a", false), "should not exists")
	});

	it("Null - false no match undefined", () => {
		assert(!conditions.Null({
			a: undefined
		}, "a", false), "should not exists")
	});

	it("Null - error", () => {
		let error
		try {
			conditions.Null({
				a: undefined
			}, "a");
		} catch (err) {
			error = err;
		}
		if (error) {
			assert.equal(error.message, "Unknown Null expectation");
		} else {
			assert.fail("Should have thrown an error");
		}
	});

	it("ForAllValues - match", () => {
		assert(conditions["ForAllValues:StringLike"]({
			a: ["this is real", "this is a test", "this is cool"]
		}, "a", "this is *"), "should match all");
	});

	it("ForAllValues - no match", () => {
		assert(!conditions["ForAllValues:StringLike"]({
			a: ["this is real", "this isn't a test", "this is cool"]
		}, "a", "this is *"), "should not match all");
	});

	it("ForAllValues - bad input", () => {
		assert(!conditions["ForAllValues:StringLike"]({
			a: ["this is real", "this isn't a test", "this is cool"]
		}, "b", "this is *"), "should not match all, missing");

		assert(!conditions["ForAllValues:StringLike"]({
			a: "this is real"
		}, "a", "this is *"), "should not match all, !array");

		assert(!conditions["ForAllValues:StringLike"]({
			a: []
		}, "a", "this is *"), "should not match all, empty array");
	});

	it("ForAnyValues - match", () => {
		assert(conditions["ForAnyValues:StringLike"]({
			a: ["this isn't real", "this isn't a test", "this is cool"]
		}, "a", "this is *"), "should match all");
	});

	it("ForAnyValues - no match", () => {
		assert(!conditions["ForAnyValues:StringLike"]({
			a: ["this isn't real", "this isn't a test", "this isn't cool"]
		}, "a", "this is *"), "should not match all");
	});

	it("ForAnyValues - bad input", () => {
		assert(!conditions["ForAnyValues:StringLike"]({
			a: ["this is real", "this isn't a test", "this is cool"]
		}, "b", "this is *"), "should not match all, missing");

		assert(!conditions["ForAnyValues:StringLike"]({
			a: "this is real"
		}, "a", "this is *"), "should not match all, !array");

		assert(!conditions["ForAnyValues:StringLike"]({
			a: []
		}, "a", "this is *"), "should not match all, empty array");
	});

	it("createMessage", () => {
		let flatRequest = {};
		flattenRequest({
			a: "a value"
		}, flatRequest, ".");
		assert.equal(conditions.createMessage("Null", flatRequest, "a", true), "Failed assertion for a(a value)to be Null");
		assert.equal(conditions.createMessage("Null", flatRequest, "a", false), "Failed assertion for a(a value)to be NotNull");

		assert.equal(conditions.createMessage("StringLike", flatRequest, "a", "this is *"), "Failed assertion for a(a value)to match this is *");
	});
});
