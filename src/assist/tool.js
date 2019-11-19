
export const deepEqual = (actual, expected, assert, stack = '', message = '') => {
  if (!stack) {
    // 顶层的时候消除undefined的属性
    if (typeof actual === 'object') {
      actual = JSON.parse(JSON.stringify(actual));
    }
    if (typeof expected === 'object') {
      expected = JSON.parse(JSON.stringify(expected));
    }
  }
  if (expected instanceof Array) {
    assert.equal(actual.length, expected.length, `${message} ${stack} 数组中成员数量不等`);
    expected.forEach((item, index) => {
      deepEqual(actual[index], item, assert, `${stack}[${index}]`, message);
    });
  } else if (typeof expected === 'object' && expected !== null) {

    const actualKeys = Object.keys(actual);
    let leftExpectedKeys = Object.keys(expected);
    const leftActualKeys = [];
    actualKeys.forEach(key => {
      if (leftExpectedKeys.includes(key)) {
        leftExpectedKeys = leftExpectedKeys.filter(k => k !== key);
      } else {
        leftActualKeys.push(key);
      }
    });
    assert.equal(leftActualKeys.join(), '', `${message} actual 的 ${stack} 中属性过多`);
    assert.equal(leftExpectedKeys.join(), '', `${message} expected 的 ${stack} 中属性过多`);


    Object.keys(expected).forEach(key => {
      deepEqual(actual[key], expected[key], assert, `${stack}.${key}`, message);
    });
  } else {
    assert.equal(actual, expected, `${message}  ${stack}`);
  }
};
