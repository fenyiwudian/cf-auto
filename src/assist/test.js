import {deepEqual} from "./tool.js";

const assert = window.chai.assert;

const failedList = [];

let data = null;

let skipCount = 0;

let todoCount = 0;


const showFailedList = (title) => {
  if (failedList.length === 0) {
    return '';
  }
  const container = document.createElement('div');
  container.style.background = '#ffffff';
  container.style.color = '#ff0000';
  const header = document.createElement('h1');
  header.innerText = title;
  container.appendChild(header);
  failedList.forEach((failed, index) => {
    let text = `${index + 1}: ${failed.description}\n`;
    let stack = failed.error.stack;
    delete failed.error.stack;
    text += JSON.stringify(failed.error, null, 2);
    const pre = document.createElement('pre');
    pre.innerText = text + `\n stack: ${stack}`;
    container.appendChild(pre);

  });
  document.body.appendChild(container);
  return container.outerHTML;
};


const reviseError = (error) => {
  return error.constructor.name === 'AssertionError'
    ? error
    : {
      message: error.message,
      stack: error.stack,
    };
};

window.addEventListener('error', (event) => {
  failedList.push({
    description: '全局错误',
    error: reviseError(event.error)
  });
  over();
});


export const test = (description, fn) => {
  try {
    const rs = fn(assert);
    return (rs && rs.then) ? rs : Promise.resolve();
  } catch (error) {
    failedList.push({
      description,
      error: reviseError(error)
    });
    return Promise.resolve();
  }
};

export const skip = () => {
  skipCount++;
  return Promise.resolve();
};

export const todo = () => {
  todoCount++;
  return Promise.resolve();
};

export const over = () => {
  window.parent.postMessage({
    name: 'end',
    skip: skipCount,
    todo: todoCount,
    fail: failedList.length,
    sid: data.sid,
    message: showFailedList(data.title),
  }, '*');
};

let started = false;

const tasks = [];

const startTask = () => {
  if(started){
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
  if(!started){
    startTask();
  }
};

const result = {
  init: (obj) => {
    data = obj;
    return result;
  },
  test: (description, fn) => {
    registerTasks(() => {
      return test(description, fn);
    });
    return result;
  },
  todo: (description, fn) => {
    registerTasks(() => {
      return todo(description, fn);
    });
    return result;
  },
  skip: (description, fn) => {
    registerTasks(() => {
      return skip(description, fn);
    });
    return result;
  },
};

export {deepEqual, result as tester}