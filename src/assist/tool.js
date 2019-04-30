
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

    const actualModel = Object.keys(actual).reduce((rs, key) => {
      rs[key] = 1;
      return rs;
    }, {});
    const leftExpectedKeyList = [];
    Object.keys(expected).forEach(key => {
      deepEqual(actual[key], expected[key], assert, `${stack}.${key}`, message);
      if (actualModel[key]) {
        delete actualModel[key];
      } else {
        leftExpectedKeyList.push(key);
      }

    });
    const leftActualKeys = Object.keys(actualModel).join();
    const leftExpectedKeys = leftExpectedKeyList.join();
    assert.equal(leftActualKeys, '', `${message} actual 的 ${stack} 中属性过多`);
    assert.equal(leftExpectedKeys, '', `${message} expected 的 ${stack} 中属性过多`);

  } else {
    assert.equal(actual, expected, `${message}  ${stack}`);
  }
};
