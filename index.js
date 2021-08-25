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
const urlParser = require('url');


const cwd = process.cwd();

/**
 * @typedef CFAutoConfig
 * @property {string} auto 测试目录
 * @property {string} dist 站点发布目录
 * @property {string} temp 测试站点临时目录
 * @property {string} serverPort 测试入口启动端口
 * @property {string} liveReloadPort 变化监听端口
 * @property {string} target ？？
 * @property {string} taskList 任务列表
 *
 */

/**
 * @type CFAutoConfig
 */
const config = require(cwd + '/auto-config.js');

const autoDir = `${cwd}/${config.auto}`;
const tempDir = `${cwd}/${config.temp}`;
const distDir = config.dist ? `${cwd}/${config.dist}` : '';


// 先清空测试目录
// fsExtra.emptyDirSync(tempDir);

/**
 * 使用webdriver启动谷歌浏览器
 * @param {string} url 要打开的url
 * @returns
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
  const replacer = (match, first, second) => {
    return first + '.js' + second;
  };
  return new Promise(resolve => {
    recursive(autoDir, [], (error, files) => {
      files.forEach(file => {
        let source = fs.readFileSync(file).toString()
          .replace(/(from ['"].+?)(['"];)/g, replacer)
          .replace(/(import ['"].+?)(['"];)/g, replacer);
        if (config.replacements) {
          Object.keys(config.replacements).forEach(key => {
            source = source.replace(key, config.replacements[key]);
          });
        }
        if (config.fileType === 'ts') {
          const ts = require('typescript');
          const result = ts.transpileModule(source, {
            compilerOptions: {
              module: ts.ModuleKind.ES2015,
              target: ts.ScriptTarget.ES2017
            }
          });
          source = result.outputText;
        }
        fsExtra.outputFileSync(file.replace(config.auto, config.temp + '/tasks').replace(/\.ts$/, '.js'), source);
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
      .replace('// ##config-pre-page##', `prePage = '${config.prePage || ""}'`)
      .replace('// ##config-target-url##', `targetUrl = '${config.target}'`));
};

/**
 * 往url中追加查询参数
 * @param url
 * @param key
 * @param value
 * @returns {string}
 */
const appendQuery = (url, key, value) => {
  const joint = url.indexOf('?') > -1 ? '&' : '?';
  return url + joint + key + '=' + value;
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

  const filter = yArgs.argv.filter;

  let url = `http://localhost:${config.serverPort}/index.html`;
  if (yArgs.argv.display) {
    url = appendQuery(url, 'display', '1');
  }
  if (yArgs.argv.filter) {
    url = appendQuery(url, 'filter', filter);
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
    const query = urlParser.parse(req.url, true).query;
    if (query.a) {
      const failedCount = Number(query.a);
      if (failedCount === 0) {
        logger('全部测试通过');
        tryQuit();
      } else {
        logger(query.b);
        if (!isWatchMode()) {
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
    fs.watch(autoDir, { recursive: true }, function () {
      clearTimeout(autoTask);
      autoTask = setTimeout(() => {
        return syncTasks();
      }, 500);
    });
    let distTask = -1;
    if (distDir) {
      fs.watch(distDir, { recursive: true }, function () {
        clearTimeout(distTask);
        distTask = setTimeout(() => {
          logger('dist changed');
          fs.writeFileSync(tempDir + '/update.js', Date.now().toString());
        }, 500);
      });
    }

    const liveServer = livereload.createServer({
      port: config.liveReloadPort,
      delay: 500
    });
    liveServer.watch(tempDir);
  }
};

const beforeStart = () => {
  return new Promise(resolve => {
    if (config.beforeStart) {
      resolve(config.beforeStart());
    } else {
      resolve();
    }
  });
};

const beforeServe = () => {
  return new Promise(resolve => {
    if (config.beforeServe) {
      resolve(config.beforeServe());
    } else {
      resolve();
    }
  });
};

beforeStart()
  .then(() => syncTasks())
  .then(() => syncFiles())
  .then(() => beforeServe())
  .then(() => serve())
  .then(() => watch());
