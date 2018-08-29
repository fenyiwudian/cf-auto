let taskList = [];
let targetUrl = '';
// ##config-task-list##
// ##config-target-url##
let failedCount = 0;

let messages = '';

const over = () => {
  const req = new XMLHttpRequest();
  let url = `http://localhost:{{serverPort}}/over${failedCount}`;
  req.open('GET', url);
  req.send();
  const div = document.createElement('div');
  if (failedCount === 0) {
    div.innerHTML = '<h1>全部测试成功</h1>';
  } else {
    div.innerHTML = messages;
  }
  document.body.appendChild(div);
};

let remained = taskList.length;


const getTargetUrl = (task) => {
  return targetUrl.replace(/{{(.+?)}}/g, (match, first) => {
    return task[first];
  })
};

const work = (task) => {
  const {sid} = task;
  const iframe = document.createElement('iframe');
  if(location.href.indexOf('display=1') > -1){
    iframe.style.width = '1000px';
    iframe.style.height = '1000px';
  }else{
    iframe.style.display = 'none';
  }

  const url = getTargetUrl(task);

  iframe.setAttribute('src', url);
  const handler = (evt) => {
    const {data} = evt;
    if (data.sid !== sid) {
      return;
    }
    if (data.name === 'end') {

      document.body.removeChild(iframe);
      window.removeEventListener('message', handler);
      if (data.fail) {
        failedCount += data.fail;
        messages += data.message;
      }
      if (taskList.length) {
        work(taskList.pop());
      }
      remained -= 1;
      if(remained === 0){
        over();
      }
    }
  };
  window.addEventListener('message', handler);
  document.body.appendChild(iframe);
};

let count = taskList.length > 10 ? 10 : taskList.length;
while (count) {
  count--;
  work(taskList.pop());
}