import { deepEqual } from "./tool.js";
import { getQueryParam } from "./query.js";

/**
 * 全局的chai断言库
 */
const assert = window.chai.assert;

/**
 * 失败列表，测试失败的案列的错误消息会累计到这里
 * @type {Array}
 */
const failedList = [];

/**
 * 一次测试的标题
 * @type {string}
 */
let title = '';

/**
 * 发生错误后是否中断测试
 * 对于各个测试案例之间前后之间存在依赖关系的场合下
 * init的时候要把该值设为true，因为某个测试失败后,
 * 后续的测试是无法正常进行的，如果不设置该标志为true，可能导致测试卡死
 * @type {boolean}
 */
let errAbort = false;

/**
 * 被跳过测试的数量
 * @type {number}
 */
let skipCount = 0;

/**
 * 等待被补全的测试
 * @type {number}
 */
let todoCount = 0;


/**
 * 显示失败测试样例的详细信息
 * @param title 标题
 * @returns {string}
 */
const showFailedList = (title) => {
  if (failedList.length === 0) {
    return '';
  }
  const container = document.createElement('div');
  container.classList.add('error-item');
  container.style.background = '#ffffff';
  container.style.color = '#ff0000';
  const header = document.createElement('h1');
  header.innerHTML = title;
  container.appendChild(header);
  failedList.forEach((failed, index) => {
    let text = `${index + 1}: ${failed.description}\n`;
    let stack = (failed.error.stack || "")
      .replace(/\.init(\.test)+/, '.init.test');
    delete failed.error.stack;
    text += JSON.stringify(failed.error, null, 2);
    const pre = document.createElement('pre');
    pre.innerText = text + `\n stack: ${stack}`;
    container.appendChild(pre);

  });
  document.body.appendChild(container);
  return container.outerHTML;
};

/**
 * 修订错误
 * @param error
 * @returns {{message: *, stack: *}}
 */
const reviseError = (error) => {
  if (typeof error === 'string') {
    return {
      message: error,
    };
  }

  return error.constructor.name === 'AssertionError'
    ? error
    : {
      message: error.message,
      stack: error.stack,
    };
};

const shouldIgnore = (event) => {
  return window.cfIgnoreGlobalError && window.cfIgnoreGlobalError(event.reason || event);
};

const handleGlobalError = (event) => {
  /**
   * 如果已经配置了忽略方法则先进行判断
   */
  if (shouldIgnore(event)) {
    return;
  }

  failedList.push({
    description: '全局错误',
    error: reviseError(event.reason || event.error)
  });
  over();
};




window.addEventListener('error', handleGlobalError);
window.addEventListener('unhandledrejection', handleGlobalError);


export const test = async (description, fn) => {
  try {
    return await fn(assert);
  } catch (error) {
    failedList.push({
      description,
      error: reviseError(error)
    });
    if (errAbort) {
      over();
    } else {
      return Promise.resolve();
    }
  }
};

export const over = () => {
  window.parent.postMessage({
    name: 'end',
    skip: skipCount,
    todo: todoCount,
    fail: failedList.length,
    path: getQueryParam()['auto_path'],
    message: showFailedList(title),
  }, '*');
};

let started = false;

const tasks = [];

const startTask = () => {
  if (started) {
    return;
  }
  started = true;
  setTimeout(() => {
    loopTasks();
  }, 100);
};

const loopTasks = () => {
  if (tasks.length === 0) {
    over();
  } else {
    tasks.shift()(loopTasks);
  }
};

const registerTasks = (fn) => {
  tasks.push((cb) => {
    fn().then(cb);
  });
  if (!started) {
    startTask();
  }
};

const result = {
  init: (text, abortOne) => {
    errAbort = abortOne;

    title = text.replace(/((?:(?:\w|-)+\/)+(?:\w|-)+)/, '<a class="test_link" href="#">$1</a>')
      .replace(/(\w{8}-(?:\w{4}-){3}\w{12})/, '<a class="editor_link" href="#">$1</a>');

    return result;
  },
  test: (description, fn) => {
    registerTasks(() => {
      return test(description, fn);
    });
    return result;
  },
  todo: () => {
    todoCount++;
    return result;
  },
  skip: () => {
    skipCount++;
    return result;
  },
};
// 告知主窗口,开始测试了
window.parent.postMessage({
  name: 'start',
  path: getQueryParam()['auto_path'],
}, '*');


export { deepEqual, result as tester };