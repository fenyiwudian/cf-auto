使用

1. 安装

```
yarn add cf-auto -D
```

2. 项目根目录下添加配置文件: auto-config.js，以下为配置示例：

```javascript
mocdule.exports = {
  // 启动前要运行的任务
  beforeServe:() => {},
  // 测试文件类型,默认为js
  fileType: "ts",
  // 测试脚本所在目录
  auto: "auto",
  // 项目在本地运行时所在的目录
  dist: "dist",
  // 自动测试运行时的临时目录
  temp: "auto_temp",
  // 自动测试服务运行的端口
  serverPort: "12345",
  // 运行测试前先要抛弃的页面
  prePage: "http://localhost:10003/login.html",
  // 自动测试监听状态下的自动更新监听端口
  liveReloadPort: "12346",
  // 测试目标地址，花括号中的参数将会被taskList的项目中的属性替代
  // auto_path为必须项目
  target: "http://localhost:4400/?{{sid}}&auto_path={{path}}",
  // 任务列表，可以配置多个
  taskList: [
    {
      // 任务要使用的问卷id
      sid: "9f7026db-f762-4709-a1ed-35c689625164",
      // 任务测试脚本坐在路径，起始于auto参数指定的文件夹
      path: "basic/index",
      // 可选的参数，将会解开后拼接到target url之后
      query_params: {},
    },
  ],
  // 自定义替换,配置到这里的键值对,在编译测试任务时,测试脚本中的对应键的内容都会被替换为值的内容
  replacements: {
    "import * as cf from '../app/services/debug.js';": "var cf = window.CF;",
  },
};
```

测试启动时将读取配置文件，对每个任务进行单独的测试，并报告测试结果。

3. 编写测试脚本

   - 测试脚本使用 es6 模块化编写
     - src/assist 下面的两本文件：test.js 和 tool.js 将会被注入到测试网站中 assist 目录下，
       测试脚本可以直接 import 这两本中 export 过的变量
     - 在测试项目中生成到 temp 目录中的结构将如下：
     ```
     temp
     |   assist // 这个就是src/assist转移过去的,
     |          // 里面的文件将会以模块方式注入到被测试网站中
     |------test.js
     |------tool.js
     |   tasks  // 这个就是auto目录中的测试脚本转移到了这里
     |   chai.js // 测试断言库，将会注入到被测试网站中
     |   index.html // 启动测试的页面，将会以iframe的方式打开每个测试任务
     |   index.js // 启动页面的依赖脚本
     ```
   - 测试脚本中可以从 assist/test 中引入 tester 开始测试,引用路径关系以生成后的 temp 目录为准

     ```javascript
     import { tester, deepEqual } from "../assist/test";
     // init可以配置一下这才整个测试的标题
     // 多次init的话将以最后一次为准
     tester
       .init("title")
       // 链式调用开始测试
       // assert是chai单元库的的assert风格断言对象
       // deepEqual是自定义的一个深对比断言方法，相对于assert.deepEqual来说
       // 前者会具体深入报考那一层那个属性没有断言成功，利于观察，后者则不会
       .test("测试1", (assert) => {
         assert.equal(1, 2, "1===2");
         deepEqual({ a: { a: 1 } }, { a: { b: 1 } }, assert, "deep equal");
       })
       // 测试可以返回一个promise,如果返回了promise
       // 则后续的测试将会等待promise被resolve之后才执行
       // 这种方式在模拟人为操作的时候，
       // 或者测试间状态互相依赖的场合非常有用
       .test("测试2", (assert) => {
         assert.equal(1, 2, "1===2");
         return new Promise((resolve) => {
           setTimeout(resolve, 2000);
         });
       })
       // 这个测试将等到'测试2'执行完两秒后才被执行
       .test("测试3", (assert) => {
         assert.equal("1", "1", "1===1");
       })
       // 暂时跳过的测试
       .skip("测试4", (assert) => {
         // 这个测试将会被跳过
       })
       // 将要做的测试
       .todo("测试5", (assert) => {
         // 这个测试也会被跳过
       });
     ```

4. 写好了测试脚本后，运行`cf-auto`即可开始跑起测试
   - 将通过 webdriver 启动 chrome 进行测试，当测试完毕后关闭浏览器并在控制台中会报告结果。
   - 如果加了--watch 参数，则会运行完测试后浏览器不会被关闭，会一直处于等待状态，并监听
     项目业务代码变化和测试脚本变化，当发生任何变化的时候将重新运行测试，浏览器测试页面中
     也会显示测试结果。
   - 如果接了--display 参数，则测试页面中将显示每个测试 iframe 中的真实运行情况
   - 添加--filter参数，可以配置taskList中的path名称来指定只测试该path对应的测试
