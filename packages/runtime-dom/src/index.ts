// 需要函数我们的 dom 操作的api和属性操作的api,将这些api传入到我们的runtime-core中
import {nodeOps} from './nodeOps'
import {patchProp} from './patchProp'
let renderOptions =  Object.assign(nodeOps,{ // 渲染所生成的所有api.  使用Object.assign是因为patchProp是函数,给他一个名(patchProp),让他成为对象的一个key,value是函数
    patchProp
})
console.log(renderOptions);

// runtime-core不依赖平台代码,因为平台代码都是传入的(比如runtime-dom)



// 我们需要渲染页面你的时候, 需要节点操作的一系列方法

export * from '@vue/runtime-core'