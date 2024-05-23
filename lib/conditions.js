var netmask = require('netmask').Netmask;

function matchify(expected, allowGlob) {
	if (!Array.isArray(expected)) {
		expected = [expected];
	}
	return expected.map(function (e) {
		e = e.toString().replace(/[^a-zA-Z0-9\_\-\*\?\: \.\/]/g, '').replace(/\./, '\\.');
		if (allowGlob) {
			return new RegExp("^" + e.replace(/\*/g, '.*').replace(/\/\.\*/, ".*") + "$");
		} else {
			return new RegExp("^" + e + "$");
		}
	});
}

function runMatch(actual, expected) {
	for (var i = 0; i < expected.length; i++) {
		// console.log("runMatch--", "[actual]", actual, "[expected]", expected[i]);
		if (actual.match(expected[i])) {
			return true;
		}
	}
	return false;
}

var conditions = {
	'StringLike': function (request, field, expected) {
		// console.log('StringLike--', "[request]", request, "[field]", field, "[expected]", expected);
		if (!(field in request) || request[field] === undefined || request[field] === null) {
			return false;
		}
		return runMatch(request[field].toString(), matchify(expected, true));
	},
	'StringNotLike': function (request, field, expected) {
		// console.log('StringNotLike--', "[request]", request, "[field]", field, "[expected]", expected);
		if (!(field in request)) {
			return false;
		}
		return !runMatch(request[field].toString(), matchify(expected, true));
	},
	'StringEquals': function (request, field, expected) {
		// console.log('StringEquals--', "[request]", request, "[field]", field, "[expected]", expected);
		if (!(field in request) || request[field] === undefined || request[field] === null) {
			return false;
		}
		return runMatch(request[field].toString(), matchify(expected, false));
	},
	'StringNotEquals': function (request, field, expected) {
		// console.log('StringNotEquals--', "[request]", request, "[field]", field, "[expected]", expected);
		if (!(field in request)) {
			return false;
		}
		return !runMatch(request[field].toString(), matchify(expected, false));
	},
	'Null': function (request, field, expected) {
		// console.log('Null--', "[request]", request, "[field]", field, "[expected]", expected);
		if (expected === true || expected === "true") {
			if (field in request) {
				var val = request[field];
				// console.log("[val]", val)
				if (val === undefined || val === null || val === "null" || val.toString().trim() === "") {
					return true;
				} else {
					return false;
				}
			} else {
				return true;
			}
		} else if (expected === false || expected === "false") {
			if (field in request) {
				var val = request[field];
				// console.log("[val]", val)
				if (val === undefined || val === null || val === "null" || val.toString().trim() === "") {
					return false;
				} else {
					return true;
				}
			} else {
				return false;
			}
		} else {
			throw new Error("Unknown Null expectation");
		}
	},
	'IpAddress': function (request, field, expected) {
		// console.log('IpAddress--', "[request]", request, "[field]", field, "[expected]", expected);
		if (!(field in request)) {
			return false;
		}
		for (var i = 0; i < expected.length; i++) {
			var mask = new netmask(expected[i]);
			if (mask.contains(request[field])) {
				return true;
			}
		}
		return false;
	}

};

//Lets add Looping
Object.keys(conditions).forEach(function (condition) {
	conditions['ForAllValues:' + condition] = function (request, field, expected) {
		var actual = request[field];
		// console.log("[field]", field, "[actual]", actual, "[expected]", expected, );
		if (!actual || !Array.isArray(actual) || !actual.length) {
			return false;
		}
		for (var i = 0; i < actual.length; i++) {
			// console.log("[ForAllValues]", actual[i], expected, conditions[condition](actual, i, expected));
			if (!conditions[condition](actual, i, expected)) {
				// console.log("all values is false");
				return false;
			}
		}
		return true;
	};
	conditions['ForAnyValues:' + condition] = conditions['ForAnyValue:' + condition] = function (request, field, expected) {
		var actual = request[field];
		// console.log("[field]", field, "[actual]", actual, "[expected]", expected, );
		if (!actual || !Array.isArray(actual) || !actual.length) {
			return false;
		}
		for (var i = 0; i < actual.length; i++) {
			// console.log("[ForAnyValues]", actual[i], expected, conditions[condition](actual, i, expected));
			if (conditions[condition](actual, i, expected)) {
				// console.log("any values is true");
				return true;
			}
		}
		return false;
	};
});

conditions.createMessage = function (conditional, flatRequest, field, expected) {
	var message = "";
	message = `Failed assertion for ${field}(${flatRequest[field]})`;
	if (conditional == "Null" && expected === true) {
		message += `to be Null`;
	} else if (conditional == "Null" && expected === false) {
		message += `to be NotNull`;
	} else {
		message += `to match ${expected}`;
	}
	return message;
};
// console.log("[conditions]", conditions);
module.exports = conditions;