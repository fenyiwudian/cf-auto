

export const deepEqual = (actual, expected, assert, stack = '') => {
  if (expected instanceof Array) {
    assert.equal(actual.length, expected.length, `${stack} 数组中成员数量不等`);
    expected.forEach((item, index) => {
      deepEqual(actual[index], item, assert, `${stack}[${index}]`);
    });
  } else if (typeof expected === 'object' && expected !== null) {
    if(typeof actual !== 'object'){
      throw `actual${stack} is not object`;
    }
    const actualModel = Object.keys(actual).reduce((rs, key) => {
      rs[key] = 1;
      return rs;
    }, {});
    Object.keys(expected).forEach(key => {
      deepEqual(actual[key], expected[key], assert, `${stack}.${key}`);
      delete actualModel[key];
    });
    const leftKeys = Object.keys(actualModel).join();
    assert.equal(leftKeys, '', `actual 的 ${stack} 中属性过多`);
  } else {
    assert.equal(actual, expected, stack);
  }
};
