import { getQueryParam } from "./assist/query.js";

let taskList = [];
let targetUrl = '';
let prePage = '';
// ##config-pre-page##
// ##config-task-list##
// ##config-target-url##
let failedCount = 0;

let messages = '';


const filter = getQueryParam().filter;

if (filter) {
  taskList = taskList.filter(task => {
    return task.path.indexOf(filter) > -1;
  });
}

let remained = taskList.length;
const allCount = taskList.length;
const progressBar = document.querySelector('.progress');
const container = document.querySelector('#container');


const progress = () => {
  if (remained) {
    progressBar.textContent = `正在测试${allCount - remained}/${allCount}`;
  } else {
    progressBar.textContent = `测试完成`;
  }
};



const over = () => {
  const req = new XMLHttpRequest();
  const worker = document.createElement('div');
  worker.innerHTML = messages.replace(/(<br>)/g, '__b_r_p_h__')
    .replace(/<pre>/g, '<pre>__b_r_p_h__');
  const msg = encodeURIComponent(worker.innerText.replace(/__b_r_p_h__/g, '\n'));
  let url = `http://localhost:{{serverPort}}/over?a=${failedCount}&b=${msg}`;
  req.open('GET', url);
  req.send();
  const div = document.createElement('div');
  if (failedCount === 0) {
    div.innerHTML = '<h1>全部测试成功</h1>';
  } else {
    div.innerHTML = messages;
  }
  container.appendChild(div);
};


const getTargetUrl = (task) => {
  let basic = targetUrl.replace(/{{(.+?)}}/g, (match, first) => {
    return task[first];
  });
  const { queryParams } = task;
  if (queryParams) {
    basic += '&' + Object.keys(queryParams).reduce((rs, key) => {
      rs.push(`${key}=${queryParams[key]}`);
      return rs;
    }, []).join('&');
  }
  return basic;
};


const work = (task) => {
  progress();
  const { path } = task;
  const iframe = document.createElement('iframe');
  iframe.style.width = '1000px';
  iframe.style.height = '1000px';

  if (location.href.indexOf('display=1') === -1) {
    iframe.style.opacity = '0';
  }
  const url = getTargetUrl(task);
  iframe.setAttribute('src', url);

  const handleItemEnd = (data) => {
    container.removeChild(iframe);
    window.removeEventListener('message', handler);
    if (data.fail) {
      failedCount += data.fail;
      messages += data.message;
    }
    if (taskList.length) {
      work(taskList.pop());
    }
    remained -= 1;
    progress();
    if (remained === 0) {
      over();
    }
  };

  const handler = (evt) => {
    const { data } = evt;
    if (data.path !== path) {
      return;
    }
    if (data.name === 'end') {
      handleItemEnd(data);
    } else if (data.name === 'start') {
      clearTimeout(timeoutId);
    }
  };
  window.addEventListener('message', handler);
  container.appendChild(iframe);
  const timeoutId = setTimeout(function () {
    handleItemEnd({ fail: true, message: `<div style='color:red'>${task.path}:加载测试任务之前主程序出现问题</div>` });
  }, 60 * 1000);
};


const doPrePage = () => {
  if (prePage) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.onload = function () {
        setTimeout(resolve, 2000);
      };
      iframe.src = prePage;
      container.appendChild(iframe);
    });
  } else {
    return Promise.resolve();
  }
};



const start = () => {
  doPrePage().then(() => {
    let count = taskList.length > 10 ? 10 : taskList.length;
    while (count) {
      count--;
      work(taskList.pop());
    }
  });
};


start();


