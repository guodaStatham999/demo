const minimist = require('minimist');
const execa = require('execa');
const args = minimist(process.argv.slice(2))

// 获取执行命令时 打包的参数
const target = args._.length ? args._[0] : 'reactivity'
const formats = args.f || 'global'; // esm-bunlder global cjs
const sourcemap = args.s || false



// react-app

execa('rollup', [
    '-wc', // --watch --config
    '--environment', 
    [
        `TARGET:${target}`,
        `FORMATS:${formats}`,
        sourcemap ? `SOURCE_MAP:true` : ``
    ].filter(Boolean).join(',')
],{
    stdio:'inherit', // 这个子进程的输出是在我们当前命令行中输出的
})


// pnpm run dev ->node dev.js
// dev.js -> rolliup打包 -> rollup.config.js