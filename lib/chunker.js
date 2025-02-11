module.exports = function(func, opts) {
	opts = Object.assign({
		chunk_size: 25,
		retry: 2,
		retryDelay: 100,
		concurrency: 2,
		concurrency_delay: 100,
		combine: false,
		data_size: null
	}, opts || {});
	// console.log("opts are ", opts);
	var records = [];
	var calls = 0;
	var completedCalls = 0;
	var requestEnd = false;

	var retries = 0;
	var errors = 0;
	var hadErrors = false;
	var batches = 0;
	var delaying = false;

	function sendAvailable() {
		var sendSize;
		if (records.length > 0 && retries <= opts.retry && completedCalls == calls && !delaying) {
			if (errors == 0) { //let's reset because last round completed successfully
				batches++;
				if (!hadErrors) {
					retries = 0;
				}
				hadErrors = false;
				console.log(`-------------------New Batch #${batches}----------------`);
				if (opts.chunk_size < 10 || opts.concurrency > 25) {
					console.log(`chunking ${opts.chunk_size} - ${opts.concurrency} times`);

				}
			} else {
				console.log(`-------------------Retrying: ${errors} records failed, retrying in ${opts.retryDelay * retries}ms, retry #${opts.retry - (opts.retry - retries) + 1}----------------`);
				retries++;
				errors = 0;
				hadErrors = true;
				delaying = true;
				setTimeout(function() {
					delaying = false;
					sendAvailable();
				}, opts.retryDelay * retries);
				return;
			}
			if (retries > opts.retry) {
				checkDone();
				return;
			}
			while (records.length > 0 && completedCalls > calls - opts.concurrency) {
				calls++;
				var dataSizeBased = false;
				if (opts.data_size) {
					sendSize = 0;
					var runningSize = 0;
					for (var i = 0; i < opts.chunk_size && i < records.length; i++) {
						var r = records[i];
						runningSize += r.size;
						if (runningSize > opts.data_size) {
							dataSizeBased = true;
							break;
						}
						sendSize++;
					}
				} else {
					sendSize = opts.chunk_size;
				}
				if (opts.combine) {
					var items = records.splice(0, sendSize);
					var toProcess = [];
					var size = 0;
					var groupStart = 0;

					for (var i = 0; i < items.length; i++) {
						var item = items[i];
						if (item.size + size >= opts.record_size) {
							console.log(`grouping items from ${groupStart + 1} to ${i} of ${items.length} of size: ${size}`);
							toProcess.push(items.slice(groupStart, i).map((e) => {
								return e.record;
							}).join(''));
							groupStart = i;
							size = item.size;
						} else {
							size += item.size;
						}
					}
					if (groupStart != items.length) {
						console.log(`grouping items from ${groupStart + 1} to ${items.length} of ${items.length} of size: ${size}`);
						toProcess.push(items.slice(groupStart, items.length).map((e) => {
							return e.record;
						}).join(''));
					}

				} else {
					var toProcess = records.splice(0, sendSize).map(function(e) {
						return e.record;
					});
				}

				if (toProcess.length > 0) {
					if (opts.chunk_size >= 10 && opts.concurrency <= 25) {
						console.log(`chunking ${toProcess.length} records (${dataSizeBased ? 'Data Size' : 'Count Size'})`);
					}
					func(toProcess, function(err, unprocessedItems) {
						if (err) {
							console.log(`Records not processed, ${unprocessedItems.length}`);

							process.nextTick(function() {
								//Don't want to add the records or change completed calls until after the current While loop is done...otherwise a nasty infinite loop could happen
								completedCalls++;
								records = unprocessedItems.map(function(e) {
									var size;
									if (!size) {
										if (typeof e === "string") {
											size = Buffer.byteLength(e);
										} else {
											size = Buffer.byteLength(JSON.stringify(e));
										}
									}
									return {
										size: size,
										record: e
									};
								}).concat(records);
								errors += unprocessedItems.length;
								setTimeout(sendAvailable, opts.concurrency_delay);
							});
						} else if (records.length) {
							completedCalls++;
							setTimeout(sendAvailable, opts.concurrency_delay);
						} else {
							completedCalls++;
							sendAvailable();
						}
					});
				} else {
					completedCalls++;
				}
			}
		} else {
			checkDone();
		}
	}

	function checkDone() {
		if (requestEnd !== false && completedCalls == calls && (records.length == 0 || retries >= opts.retry)) {
			if (records.length > 0) {
				requestEnd("Cannot process all the entries", records.length);
				requestEnd = false;
			} else {
				requestEnd(null, []);
				requestEnd = false;
			}
		}
	}

	return {
		add: function(item) {
			requestEnd = false;
			var size;
			if (!size) {
				if (typeof item === "string") {
					size = Buffer.byteLength(item);
				} else {
					size = Buffer.byteLength(JSON.stringify(item));
				}
			}

			if (opts.record_size && size > opts.record_size) {
				console.log("record size is too large", size, opts.record_size);
			} else if (opts.data_size && size > opts.data_size) {
				console.log("data size is too large");
			} else {
				records.push({
					size: size,
					record: item
				});
				if (records.length >= opts.chunk_size * opts.concurrency) {
					sendAvailable();
				}
			}
		},
		end: function(callback) {
			requestEnd = callback;
			sendAvailable();
		}
	};
};
