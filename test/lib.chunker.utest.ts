import sinon from "sinon";
import chai, { expect, assert } from "chai";
import sinonchai from "sinon-chai";
chai.use(sinonchai);

import chunker from "../lib/chunker";
import { promisify } from "util";


describe('lib/chunker', function () {

	it("chunks", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(null, []);
		});

		for (let i = 0; i < 100; i++) {
			chunk.add({ id: i })
		}

		await promisify(chunk.end).bind(chunk)();
		assert.deepEqual(chunks, [
			Array(25).fill(0).map((_, id) => ({ id })),
			Array(25).fill(0).map((_, id) => ({ id: id + 25 })),
			Array(25).fill(0).map((_, id) => ({ id: id + 50 })),
			Array(25).fill(0).map((_, id) => ({ id: id + 75 }))
		]);
	});

	it("chunks - combine", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(null, []);
		}, { combine: true, record_size: 100 });

		for (let i = 0; i < 100; i++) {
			chunk.add(JSON.stringify({ id: i }))
		}

		await promisify(chunk.end).bind(chunk)();
		assert.deepEqual(chunks, [
			[
				Array(12).fill(0).map((_, id) => JSON.stringify({ id })).join(""),
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 12 })).join(""),
				Array(2).fill(0).map((_, id) => JSON.stringify({ id: id + 23 })).join(""),
			],
			[
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 25 })).join(""),
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 36 })).join(""),
				Array(3).fill(0).map((_, id) => JSON.stringify({ id: id + 47 })).join(""),
			],
			[
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 50 })).join(""),
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 61 })).join(""),
				Array(3).fill(0).map((_, id) => JSON.stringify({ id: id + 72 })).join(""),
			],
			[
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 75 })).join(""),
				Array(11).fill(0).map((_, id) => JSON.stringify({ id: id + 86 })).join(""),
				Array(3).fill(0).map((_, id) => JSON.stringify({ id: id + 97 })).join(""),
			]
		]);
	});

	it("chunks - failed", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(new Error("failed"), items);
		});

		for (let i = 0; i < 100; i++) {
			chunk.add({ id: i })
		}

		let error;
		try {
			await promisify(chunk.end).bind(chunk)();
		} catch (err) {
			error = err;
		}
		assert(error != null, "should throw an error");
		assert.equal(error, "Cannot process all the entries");
	});

	it("chunks - over record_size", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(null, []);
		}, { record_size: 10 });

		for (let i = 0; i < 20; i++) {
			chunk.add({ id: i.toString() })
		}

		await promisify(chunk.end).bind(chunk)();
		assert.deepEqual(chunks, [
			Array(10).fill(0).map((_, id) => ({ id: id.toString() }))
		]);
	});

	it("chunks - record over data_size", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(null, []);
		}, { data_size: 10 });

		for (let i = 0; i < 20; i++) {
			chunk.add({ id: i.toString() })
		}

		await promisify(chunk.end).bind(chunk)();
		assert.deepEqual(chunks,
			Array(10).fill(0).map((_, id) => ([{ id: id.toString() }]))
		);
	});

	it("chunks - over data_size", async () => {
		let chunks = []
		let chunk = chunker(function (items, done) {
			chunks.push(items)
			done(null, []);
		}, { data_size: 100 });

		for (let i = 0; i < 20; i++) {
			chunk.add({ id: i.toString() })
		}

		await promisify(chunk.end).bind(chunk)();
		assert.deepEqual(chunks, [
			Array(10).fill(0).map((_, id) => ({ id: id.toString() })),
			Array(9).fill(0).map((_, id) => ({ id: (id + 10).toString() })),
			Array(1).fill(0).map((_, id) => ({ id: (id + 19).toString() }))
		]);
	});
});
