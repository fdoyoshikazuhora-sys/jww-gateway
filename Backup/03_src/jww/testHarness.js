import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

const ARRAY_CONTAINING = Symbol("arrayContaining");
const OBJECT_CONTAINING = Symbol("objectContaining");
const STRING_CONTAINING = Symbol("stringContaining");
const STRING_MATCHING = Symbol("stringMatching");
const ANY = Symbol("any");

function arrayContaining(items) {
  return { type: ARRAY_CONTAINING, items };
}

function objectContaining(shape) {
  return { type: OBJECT_CONTAINING, shape };
}

function stringContaining(text) {
  return { type: STRING_CONTAINING, text };
}

function stringMatching(pattern) {
  return { type: STRING_MATCHING, pattern };
}

function any(constructor) {
  return { type: ANY, constructor };
}

function isMatcher(value, type) {
  return value && typeof value === "object" && value.type === type;
}

function matches(actual, expected) {
  if (isMatcher(expected, STRING_CONTAINING)) {
    assert.equal(typeof actual, "string");
    assert.ok(actual.includes(expected.text));
    return;
  }

  if (isMatcher(expected, STRING_MATCHING)) {
    assert.equal(typeof actual, "string");
    assert.match(actual, expected.pattern);
    return;
  }

  if (isMatcher(expected, ANY)) {
    const constructor = expected.constructor;
    if (constructor === Number) assert.equal(typeof actual, "number");
    else if (constructor === String) assert.equal(typeof actual, "string");
    else if (constructor === Boolean) assert.equal(typeof actual, "boolean");
    else if (constructor === Array) assert.ok(Array.isArray(actual));
    else assert.ok(actual instanceof constructor);
    return;
  }

  if (isMatcher(expected, ARRAY_CONTAINING)) {
    assert.ok(Array.isArray(actual), "Expected actual value to be an array");
    for (const item of expected.items) {
      assert.ok(
        actual.some((candidate) => {
          try {
            matches(candidate, item);
            return true;
          } catch (_) {
            return false;
          }
        }),
        `Expected array to contain ${JSON.stringify(item)}`
      );
    }
    return;
  }

  if (isMatcher(expected, OBJECT_CONTAINING)) {
    assert.ok(
      actual && typeof actual === "object",
      "Expected actual value to be an object"
    );
    for (const [key, value] of Object.entries(expected.shape)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(actual, key),
        `Expected object to contain key ${key}`
      );
      matches(actual[key], value);
    }
    return;
  }

  if (expected && typeof expected === "object") {
    if (Array.isArray(expected)) {
      assert.ok(Array.isArray(actual), "Expected actual value to be an array");
      assert.equal(actual.length, expected.length);
      expected.forEach((item, index) => matches(actual[index], item));
      return;
    }

    assert.ok(
      actual && typeof actual === "object",
      "Expected actual value to be an object"
    );
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) {
      matches(actual[key], value);
    }
    return;
  }

  assert.deepEqual(actual, expected);
}

function matchesSubset(actual, expected) {
  if (isMatcher(expected, ARRAY_CONTAINING) || isMatcher(expected, OBJECT_CONTAINING)) {
    matches(actual, expected);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), "Expected actual value to be an array");
    assert.ok(actual.length >= expected.length);
    expected.forEach((item, index) => matchesSubset(actual[index], item));
    return;
  }
  if (expected && typeof expected === "object") {
    assert.ok(
      actual && typeof actual === "object",
      "Expected actual value to be an object"
    );
    for (const [key, value] of Object.entries(expected)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(actual, key),
        `Expected object to contain key ${key}`
      );
      matchesSubset(actual[key], value);
    }
    return;
  }
  assert.deepEqual(actual, expected);
}

function runExpectation(negated, assertion) {
  let failed = false;
  try {
    assertion();
  } catch (error) {
    failed = true;
    if (!negated) throw error;
  }
  if (negated && !failed) {
    throw new assert.AssertionError({
      message: "Expected assertion to fail",
    });
  }
}

function expect(actual) {
  const api = (negated = false) => ({
    get not() {
      return api(!negated);
    },
    toBe(expected) {
      runExpectation(negated, () => assert.ok(Object.is(actual, expected)));
    },
    toEqual(expected) {
      runExpectation(negated, () => matches(actual, expected));
    },
    toMatchObject(expected) {
      runExpectation(negated, () => matchesSubset(actual, expected));
    },
    toContain(expected) {
      runExpectation(negated, () => {
        if (typeof actual === "string") {
          assert.ok(actual.includes(expected));
          return;
        }
        assert.ok(Array.isArray(actual), "Expected actual value to be iterable");
        assert.ok(actual.some((item) => isDeepStrictEqual(item, expected)));
      });
    },
    toBeGreaterThan(expected) {
      runExpectation(negated, () => assert.ok(actual > expected));
    },
  });
  return api(false);
}

expect.arrayContaining = arrayContaining;
expect.objectContaining = objectContaining;
expect.stringContaining = stringContaining;
expect.stringMatching = stringMatching;
expect.any = any;

globalThis.describe = describe;
globalThis.it = it;
globalThis.expect = expect;
