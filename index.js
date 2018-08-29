#! /usr/bin/env node

/**
 * 1. 运行该脚本将会启动一个测试任务
 * 2. 任务会将auto目录下的文件编译到auto_temp目录下
 * 3. 然后启动一个静态服务器指向auto_temp
 * 4. 通过web-driver启动浏览器打开auto_temp下面的index.html运行测试
 * 5. 测试完毕后报告测试结果，关闭浏览器，退出任务。
 * 5. 如过是--watch模式则会启动监听模式，并处于监听等待状态，不会退出任务，
 *    每当测试代码或业务代码发生任何改变后将重新运行测试。
 */


//---------------------------//
const recursive = require('recursive-readdir');
const fsExtra = require('fs-extra');
const fs = require('fs');
const http = require('http');
const yArgs = require('yargs');
const livereload = require('livereload');
const ecstatic = require('ecstatic');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('chromedriver').path;


const cwd = process.cwd();

/**
 * @name CFAutoConfig
 * @prop auto
 * @prop dist
 * @prop temp
 * @prop serverPort
 * @prop liveReloadPort
 * @prop target
 * @prop taskList
 *
 */
const config = JSON.parse(fs.readFileSync(cwd + '/auto.json'));

const autoDir = `${cwd}/${config.auto}`;
const tempDir = `${cwd}/${config.temp}`;
const distDir = `${cwd}/${config.dist}`;

// 先清空测试目录
fsExtra.emptyDirSync(tempDir);

/**
 * 使用webdriver启动谷歌浏览器
 * @param {string} url 要打开的url
 * @returns {!ThenableWebDriver}
 */
const drive = (url) => {
  const service = new chrome.ServiceBuilder(path).build();
  chrome.setDefaultService(service);
  const driver = new webdriver.Builder()
    .withCapabilities(webdriver.Capabilities.chrome())
    .build();
  driver.get(url);
  return driver;
};

/**
 * 是否为监听模式
 * @returns {boolean}
 */
const isWatchMode = () => {
  return yArgs.argv.watch;
};

/**
 * 打日志
 * @param message
 */
const logger = (message) => {
  console.info(`[${(new Date()).toTimeString().substr(0, 8)}] ${message}`); // eslint-disable-line
};

/**
 * 同步文件，把auto目录的文件都同步到auto_temp中
 * 并对启动的内容稍微做些处理
 * 由于写代码的时候import文件的时候不会写后缀
 * 再同步的过程中加上文件后缀
 * @returns {Promise}
 */
const syncTasks = () => {
  return new Promise(resolve => {
    recursive(autoDir, [], (error, files) => {
      files.forEach(file => {
        const text = fs.readFileSync(file).toString()
          .replace(/(import .+?)(['"];)/g, (match, first, second) => {
            return first + '.js' + second;
          });
        fsExtra.outputFileSync(file.replace(config.auto, config.temp + '/tasks'), text);
      });
      logger('tasks loaded');
      resolve();
    });
  });
};

/**
 * 同步库
 */
const syncFiles = () => {
  fsExtra.copySync(cwd + '/node_modules/chai/chai.js', tempDir + '/chai.js');
  fsExtra.copySync(__dirname + '/src/assist', tempDir + '/assist');
  const indexHtml = fs.readFileSync(__dirname + '/src/index.html').toString();
  fs.writeFileSync(tempDir + '/index.html',
    indexHtml.replace('{{liveReloadPort}}', config.liveReloadPort));
  const indexJs = fs.readFileSync(__dirname + '/src/index.js').toString();
  fs.writeFileSync(tempDir + '/index.js',
    indexJs.replace('{{serverPort}}', config.serverPort)
      .replace('// ##config-task-list##', `taskList = ${JSON.stringify(config.taskList, null, 2)}`)
      .replace('// ##config-target-url##', `targetUrl = '${config.target}'`));
};

/**
 * 启动静态服务器
 */
const serve = () => {
  const server = http.createServer(ecstatic({
    root: tempDir,
    cors: true,
    cache: 0,
  })).listen(config.serverPort);

  let url = `http://localhost:${config.serverPort}/index.html`;
  if (yArgs.argv.display) {
    url += '?display=1';
  }
  const driver = drive(url);

  const tryQuit = () => {
    if (!isWatchMode()) {
      driver.quit();
      server.close();
      setTimeout(() => {
        process.exit();
      }, 500);
    }
  };

  server.on('request', function (req) {
    const match = req.url.match(/\/over(\d+)$/);
    if (match) {
      const failedCount = Number(match[1]);
      if (failedCount === 0) {
        logger('全部测试通过');
        tryQuit();
      } else {
        const message = `${failedCount}个测试失败,请在测试页面查看详情`;
        if (isWatchMode()) {
          logger(message);
        } else {
          driver.quit();
          server.close();
          setTimeout(() => {
            throw '测试失败';
          }, 500);
        }
      }
    }
  });
};

/**
 * 监听变化
 */
const watch = () => {
  if (yArgs.argv.watch) {
    let autoTask = -1;
    fs.watch(autoDir, {recursive: true}, function () {
      clearTimeout(autoTask);
      autoTask = setTimeout(() => {
        syncTasks();
      }, 500);
    });
    let distTask = -1;
    fs.watch(distDir, {recursive: true}, function () {
      clearTimeout(distTask);
      distTask = setTimeout(() => {
        logger('dist changed');
        fs.writeFileSync(tempDir + '/update.js', Date.now());
      }, 500);
    });
    const liveServer = livereload.createServer({
      port: config.liveReloadPort,
      delay: 500
    });
    liveServer.watch(tempDir);
  }
};


syncTasks()
  .then(() => syncTasks())
  .then(() => syncFiles())
  .then(() => serve())
  .then(() => watch());